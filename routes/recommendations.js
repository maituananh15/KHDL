const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect } = require('../middleware/auth');
const History = require('../models/History');
const Movie = require('../models/Movie');
const Recommendation = require('../ml/recommendation');

// @route   GET /api/recommendations
// @desc    Get movie recommendations for user
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Get user's viewing history (only views, not clicks)
    const userHistory = await History.find({ 
      userId: req.user.id,
      action: { $in: ['view', 'watch'] }
    })
      .populate('movieId')
      .sort({ clickedAt: -1 });
    
    console.log(`Getting recommendations for user ${req.user.id}, viewing history count: ${userHistory.length}, page: ${page}`);
    
    if (userHistory.length === 0) {
      // If no viewing history, return top 20 movies by rating
      console.log('No viewing history, returning top 20 movies');
      const topMovies = await Movie.aggregate([
        {
          $addFields: {
            viewsForSort: { $ifNull: ['$views', 0] },
            ratingForSort: { $ifNull: ['$rating', 0] }
          }
        },
        { $sort: { ratingForSort: -1, viewsForSort: -1 } },
        { $limit: 20 },
        { $project: { viewsForSort: 0, ratingForSort: 0 } }
      ]);
      
      return res.json({
        success: true,
        type: 'popular',
        count: topMovies.length,
        total: topMovies.length,
        page: 1,
        pages: 1,
        data: topMovies
      });
    }
    
    // Get recommendations using ML model
    try {
      const recommendation = new Recommendation();
      // Lấy nhiều hơn để có thể paginate
      const allRecommendations = await recommendation.getRecommendations(
        req.user.id,
        limit * 10 // Lấy nhiều hơn để có thể paginate
      );
      
      // Đảm bảo recommendations là array
      const safeRecommendations = Array.isArray(allRecommendations) ? allRecommendations : [];
      const total = safeRecommendations.length;
      
      // Paginate
      const paginatedRecommendations = safeRecommendations.slice(skip, skip + limit);
      
      res.json({
        success: true,
        type: 'personalized',
        count: paginatedRecommendations.length,
        total,
        page,
        pages: Math.ceil(total / limit),
        data: paginatedRecommendations
      });
    } catch (error) {
      console.error('Error in recommendation engine:', error);
      // Fallback to top 20 movies by rating
      const topMovies = await Movie.aggregate([
        {
          $addFields: {
            viewsForSort: { $ifNull: ['$views', 0] },
            ratingForSort: { $ifNull: ['$rating', 0] }
          }
        },
        { $sort: { ratingForSort: -1, viewsForSort: -1 } },
        { $limit: 20 },
        { $project: { viewsForSort: 0, ratingForSort: 0 } }
      ]);
      
      res.json({
        success: true,
        type: 'popular',
        count: topMovies.length,
        total: topMovies.length,
        page: 1,
        pages: 1,
        data: topMovies
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error generating recommendations',
      error: error.message
    });
  }
});

// @route   GET /api/recommendations/similar/:movieId
// @desc    Get similar movies to a specific movie
// @access  Public
router.get('/similar/:movieId', async (req, res) => {
  try {
    const movieId = req.params.movieId;
    const limit = parseInt(req.query.limit) || 10;
    
    const movie = await Movie.findById(movieId);
    if (!movie) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }
    
    // Build match conditions only when genres/tags actually exist to avoid
    // returning the same popular list for every movie
    const orConditions = [];
    if (Array.isArray(movie.genres) && movie.genres.length > 0) {
      orConditions.push({ genres: { $in: movie.genres } });
    }
    if (Array.isArray(movie.tags) && movie.tags.length > 0) {
      orConditions.push({ tags: { $in: movie.tags } });
    }

    if (orConditions.length === 0) {
      return res.json({
        success: true,
        count: 0,
        data: []
      });
    }

    // Find similar movies based on available genres/tags
    const similarMovies = await Movie.aggregate([
      {
        $match: {
          $or: orConditions,
          _id: { $ne: new mongoose.Types.ObjectId(movieId) }
        }
      },
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
    
    res.json({
      success: true,
      count: similarMovies.length,
      data: similarMovies
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;

