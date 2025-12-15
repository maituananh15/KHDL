const mongoose = require('mongoose');
const History = require('../models/History');
const Movie = require('../models/Movie');

const ObjectId = mongoose.Types.ObjectId;

class Recommendation {
  constructor() {
    this.similarityCache = new Map();
  }

  /**
   * Get personalized recommendations for a user
   */
  async getRecommendations(userId, limit = 10) {
    try {
      // Get user's viewing history (only views, not clicks)
      const userHistory = await History.find({ 
        userId,
        action: { $in: ['view', 'watch'] }
      })
        .populate('movieId')
        .lean();

      if (userHistory.length === 0) {
        // Return top 20 movies by rating if no viewing history
        return await this.getPopularMovies(20);
      }

      // Get user's watched movie IDs
      const watchedMovieIds = userHistory.map(h => {
        const movieId = h.movieId;
        return movieId._id ? movieId._id.toString() : movieId.toString();
      });
      
      // Get genres from watched movies
      const userGenres = this.extractGenresFromHistory(userHistory);
      
      // Strategy 1: Content-based filtering (genre similarity)
      const contentBasedRecs = await this.contentBasedRecommendation(
        userGenres,
        watchedMovieIds,
        limit * 2
      );

      // Strategy 2: Collaborative filtering (users with similar tastes)
      const collaborativeRecs = await this.collaborativeFiltering(
        userId,
        watchedMovieIds,
        limit * 2
      );

      // Combine and deduplicate recommendations
      const combinedRecs = this.combineRecommendations(
        contentBasedRecs,
        collaborativeRecs,
        watchedMovieIds
      );

      // Score and rank recommendations
      const scoredRecs = await this.scoreRecommendations(combinedRecs, userId);

      // Return top N recommendations
      return scoredRecs
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(rec => rec.movie);
    } catch (error) {
      console.error('Error getting recommendations:', error);
      return await this.getPopularMovies(limit);
    }
  }

  /**
   * Content-based recommendation using genre similarity
   */
  async contentBasedRecommendation(userGenres, excludeIds, limit) {
    const genreWeights = this.calculateGenreWeights(userGenres);
    
    // Find movies with similar genres
    const movies = await Movie.find({
      _id: { $nin: excludeIds },
      genres: { $in: Object.keys(genreWeights) }
    }).limit(limit * 3);

    // Score movies based on genre overlap
    const scored = movies.map(movie => {
      let score = 0;
      movie.genres.forEach(genre => {
        if (genreWeights[genre]) {
          score += genreWeights[genre];
        }
      });
      // Normalize by number of genres
      score = score / Math.max(movie.genres.length, 1);
      // Boost by rating and popularity
      score += (movie.rating || 5) * 0.1;
      score += Math.log((movie.views || 0) + 1) * 0.05;
      return { movie, score };
    });

    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Collaborative filtering - find users with similar tastes
   */
  async collaborativeFiltering(userId, excludeIds, limit) {
    try {
      // Get user's watched movies (viewing history only)
      const userHistory = await History.find({ 
        userId,
        action: { $in: ['view', 'watch'] }
      })
        .select('movieId')
        .lean();
      
      const userMovieIds = userHistory.map(h => h.movieId.toString());

      if (userMovieIds.length === 0) return [];

      // Find other users who watched similar movies
      const similarUsers = await History.aggregate([
        {
          $match: {
            userId: { $ne: new ObjectId(userId) },
            movieId: { $in: userMovieIds.map(id => new ObjectId(id)) },
            action: { $in: ['view', 'watch'] }
          }
        },
        {
          $group: {
            _id: '$userId',
            commonMovies: { $addToSet: '$movieId' },
            count: { $sum: 1 }
          }
        },
        {
          $match: { count: { $gte: 1 } }
        },
        {
          $sort: { count: -1 }
        },
        {
          $limit: 50
        }
      ]);

      // Get movies watched by similar users
      const similarUserIds = similarUsers.map(u => u._id);
      const recommendedMovies = await History.aggregate([
        {
          $match: {
            userId: { $in: similarUserIds },
            movieId: { $nin: excludeIds.map(id => new ObjectId(id)) },
            action: { $in: ['view', 'watch'] }
          }
        },
        {
          $group: {
            _id: '$movieId',
            count: { $sum: 1 },
            avgDuration: { $avg: '$duration' }
          }
        },
        {
          $sort: { count: -1, avgDuration: -1 }
        },
        {
          $limit: limit
        }
      ]);

      // Fetch full movie documents
      const movieIds = recommendedMovies.map(m => m._id);
      const movies = await Movie.find({ _id: { $in: movieIds } });

      // Create map for scoring
      const scoreMap = new Map();
      recommendedMovies.forEach(rec => {
        scoreMap.set(rec._id.toString(), rec.count);
      });

      return movies.map(movie => ({
        movie,
        score: scoreMap.get(movie._id.toString()) || 0
      }));
    } catch (error) {
      console.error('Error in collaborative filtering:', error);
      return [];
    }
  }

  /**
   * Extract genres from user's watch history
   */
  extractGenresFromHistory(history) {
    const genreCount = {};
    
    history.forEach(item => {
      if (item.movieId && item.movieId.genres) {
        item.movieId.genres.forEach(genre => {
          genreCount[genre] = (genreCount[genre] || 0) + 1;
        });
      }
    });

    return genreCount;
  }

  /**
   * Calculate genre weights based on user preferences
   */
  calculateGenreWeights(genreCount) {
    const total = Object.values(genreCount).reduce((a, b) => a + b, 0);
    const weights = {};
    
    Object.keys(genreCount).forEach(genre => {
      weights[genre] = genreCount[genre] / total;
    });

    return weights;
  }

  /**
   * Combine recommendations from different strategies
   */
  combineRecommendations(contentBased, collaborative, excludeIds) {
    const movieMap = new Map();

    // Add content-based recommendations
    contentBased.forEach(({ movie, score }) => {
      if (!excludeIds.includes(movie._id.toString())) {
        movieMap.set(movie._id.toString(), { movie, score, type: 'content' });
      }
    });

    // Add collaborative recommendations
    collaborative.forEach(({ movie, score }) => {
      if (!excludeIds.includes(movie._id.toString())) {
        const existing = movieMap.get(movie._id.toString());
        if (existing) {
          // Boost score if found in both
          existing.score = existing.score * 1.5 + score;
          existing.type = 'hybrid';
        } else {
          movieMap.set(movie._id.toString(), { movie, score, type: 'collaborative' });
        }
      }
    });

    return Array.from(movieMap.values());
  }

  /**
   * Score recommendations with additional factors
   */
  async scoreRecommendations(recommendations, userId) {
    return recommendations.map(({ movie, score, type }) => {
      // Boost score based on movie quality
      let finalScore = score;
      
      // Rating boost
      if (movie.rating) {
        finalScore += movie.rating * 0.2;
      }
      
      // Popularity boost (logarithmic to avoid over-weighting)
      finalScore += Math.log((movie.views || 0) + 1) * 0.1;
      
      // Recency boost (newer movies get slight boost)
      if (movie.year) {
        const currentYear = new Date().getFullYear();
        const age = currentYear - movie.year;
        if (age < 5) {
          finalScore += 0.1 * (5 - age);
        }
      }
      
      return { movie, score: finalScore, type };
    });
  }

  /**
   * Get popular movies as fallback (top movies by rating)
   */
  async getPopularMovies(limit) {
    return await Movie.aggregate([
      {
        $addFields: {
          viewsForSort: { $ifNull: ['$views', 0] },
          ratingForSort: { $ifNull: ['$rating', 0] }
        }
      },
      { $sort: { ratingForSort: -1, viewsForSort: -1 } },
      { $limit: limit },
      { $project: { viewsForSort: 0, ratingForSort: 0 } }
    ]);
  }
}

module.exports = Recommendation;

