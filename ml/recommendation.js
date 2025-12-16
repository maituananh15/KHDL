const mongoose = require('mongoose');
const History = require('../models/history');
const Movie = require('../models/movie');

const ObjectId = mongoose.Types.ObjectId;

class Recommendation {
  constructor() {
    this.similarityCache = new Map();
  }

  /**
   * Get personalized recommendations for a user
   * Bây giờ ưu tiên: gợi ý phim dựa trên bộ phim người dùng vừa xem
   * (dựa trên mô tả/nội dung của phim đó) thay vì phân tích toàn bộ lịch sử.
   */
  async getRecommendations(userId, limit = 10) {
    try {
      // Lấy bản ghi xem gần nhất của user (view/watch)
      const lastHistory = await History.findOne({ 
        userId,
        action: { $in: ['view', 'watch'] }
      })
        .populate('movieId') // lấy luôn thông tin phim
        .sort({ clickedAt: -1 }) // mới nhất trước
        .lean();

      // Nếu chưa từng xem phim nào -> trả về danh sách phổ biến
      if (!lastHistory || !lastHistory.movieId) {
        return await this.getPopularMovies(limit);
      }

      const baseMovie = lastHistory.movieId;
      const excludeIds = [baseMovie._id.toString()];

      // Gợi ý dựa trên mô tả của phim vừa xem (content-based theo description)
      const descriptionBasedRecs = await this.descriptionBasedRecommendation(
        baseMovie,
        excludeIds,
        limit * 3
      );

      // Nếu vì lý do nào đó không tính được theo mô tả, fallback về gợi ý theo thể loại
      let combinedRecs = descriptionBasedRecs;
      if (!combinedRecs || combinedRecs.length === 0) {
        const userGenres = this.extractGenresFromMovie(baseMovie);
        const contentBasedRecs = await this.contentBasedRecommendation(
          userGenres,
          excludeIds,
          limit * 3
        );
        combinedRecs = contentBasedRecs;
      }

      // Score & sort (đã có score sơ bộ từ description/genre, cộng thêm rating/views...)
      const scoredRecs = await this.scoreRecommendations(combinedRecs, userId);

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
   * Content-based theo mô tả phim (description)
   * Ý tưởng đơn giản: so khớp token giữa mô tả phim đang xem và các phim khác (Jaccard)
   */
  async descriptionBasedRecommendation(baseMovie, excludeIds, limit) {
    if (!baseMovie || !baseMovie.description) {
      return [];
    }

    // Tokenize mô tả phim gốc
    const baseTokens = this.tokenizeText(baseMovie.description);
    if (baseTokens.size === 0) {
      return [];
    }

    // Lấy danh sách phim khác để so sánh
    const candidates = await Movie.find({
      _id: { $nin: excludeIds }
    }).select('title description genres rating views year poster').lean();

    const scored = [];

    for (const movie of candidates) {
      if (!movie.description) continue;

      const movieTokens = this.tokenizeText(movie.description);
      if (movieTokens.size === 0) continue;

      // Jaccard similarity giữa 2 tập token
      const similarity = this.jaccardSimilarity(baseTokens, movieTokens);
      if (similarity <= 0) continue;

      // Base score = độ giống mô tả
      let score = similarity * 10; // scale lên một chút để dễ kết hợp

      // Nhẹ nhàng thưởng thêm nếu trùng thể loại
      if (Array.isArray(baseMovie.genres) && Array.isArray(movie.genres)) {
        const overlap = movie.genres.filter(g => baseMovie.genres.includes(g)).length;
        if (overlap > 0) {
          score += overlap * 0.5;
        }
      }

      scored.push({ movie, score });
    }

    // Trả về top theo score mô tả
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Tokenize text: chuyển về lower-case, bỏ ký tự đặc biệt, tách từ, loại bỏ từ quá ngắn
   */
  tokenizeText(text) {
    if (!text || typeof text !== 'string') return new Set();
    const cleaned = text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '') // bỏ dấu tiếng Việt
      .replace(/[^a-z0-9\s]/g, ' ');

    const tokens = cleaned
      .split(/\s+/)
      .filter(t => t.length >= 3); // bỏ từ quá ngắn / ít thông tin

    return new Set(tokens);
  }

  /**
   * Jaccard similarity giữa 2 tập token
   */
  jaccardSimilarity(setA, setB) {
    if (!setA || !setB || setA.size === 0 || setB.size === 0) return 0;

    let intersection = 0;
    for (const token of setA) {
      if (setB.has(token)) intersection++;
    }

    const union = setA.size + setB.size - intersection;
    if (union === 0) return 0;

    return intersection / union;
  }

  /**
   * Lấy thống kê thể loại từ một phim (dùng cho fallback content-based)
   */
  extractGenresFromMovie(movie) {
    const genreCount = {};
    if (movie && Array.isArray(movie.genres)) {
      movie.genres.forEach(g => {
        genreCount[g] = (genreCount[g] || 0) + 1;
      });
    }
    return genreCount;
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

