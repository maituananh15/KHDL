const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const ClickHistory = require('../models/ClickHistory');
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
    
    // Get user's click history
    const userHistory = await ClickHistory.find({ userId: req.user.id })
      .populate('movieId')
      .sort({ clickedAt: -1 });
    
    console.log(`Getting recommendations for user ${req.user.id}, history count: ${userHistory.length}, page: ${page}`);
    
    if (userHistory.length === 0) {
      // If no history, return popular movies with pagination
      console.log('No history, returning popular movies');
      const total = await Movie.countDocuments();
      const popularMovies = await Movie.find()
        .sort({ clickCount: -1, rating: -1 })
        .skip(skip)
        .limit(limit);
      
      return res.json({
        success: true,
        type: 'popular',
        count: popularMovies.length,
        total,
        page,
        pages: Math.ceil(total / limit),
        data: popularMovies
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
      // Fallback to popular movies with pagination
      const total = await Movie.countDocuments();
      const popularMovies = await Movie.find()
        .sort({ clickCount: -1, rating: -1 })
        .skip(skip)
        .limit(limit);
      
      res.json({
        success: true,
        type: 'popular',
        count: popularMovies.length,
        total,
        page,
        pages: Math.ceil(total / limit),
        data: popularMovies
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
    
    // Find similar movies based on genres and tags
    const similarMovies = await Movie.find({
      $or: [
        { genres: { $in: movie.genres } },
        { tags: { $in: movie.tags } }
      ],
      _id: { $ne: movieId }
    })
      .sort({ rating: -1, clickCount: -1 })
      .limit(limit);
    
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

