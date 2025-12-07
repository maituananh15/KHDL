const express = require('express');
const router = express.Router();
const ClickHistory = require('../models/ClickHistory');
const Movie = require('../models/Movie');
const { protect } = require('../middleware/auth');

// @route   POST /api/history/click
// @desc    Record a click/view on a movie
// @access  Private
router.post('/click', protect, async (req, res) => {
  try {
    const { movieId, duration, action, metadata } = req.body;
    
    if (!movieId) {
      return res.status(400).json({
        success: false,
        message: 'Movie ID is required'
      });
    }
    
    // Check if movie exists
    const movie = await Movie.findById(movieId);
    if (!movie) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }
    
    // Create click history
    const clickHistory = await ClickHistory.create({
      userId: req.user.id,
      movieId,
      duration: duration || 0,
      action: action || 'click',
      metadata: metadata || {}
    });
    
    console.log(`✓ Click recorded: user ${req.user.id}, movie ${movieId}`);
    
    // Update movie click count
    await Movie.findByIdAndUpdate(movieId, {
      $inc: { clickCount: 1, views: 1 }
    });
    
    res.status(201).json({
      success: true,
      data: clickHistory
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

// @route   GET /api/history
// @desc    Get user's click history
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const history = await ClickHistory.find({ userId: req.user.id })
      .populate('movieId', 'title poster rating genres year')
      .sort({ clickedAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await ClickHistory.countDocuments({ userId: req.user.id });
    
    res.json({
      success: true,
      count: history.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: history
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

// @route   GET /api/history/movies
// @desc    Get unique movies from user's click history with pagination
// @access  Private
router.get('/movies', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    console.log(`Getting history movies for user ${req.user.id}, page: ${page}`);
    
    const history = await ClickHistory.find({ userId: req.user.id })
      .populate('movieId')
      .sort({ clickedAt: -1 });
    
    console.log(`Found ${history.length} history records`);
    
    // Get unique movies
    const movieMap = new Map();
    history.forEach(item => {
      if (item.movieId) {
        const movieId = item.movieId._id ? item.movieId._id.toString() : item.movieId.toString();
        if (!movieMap.has(movieId)) {
          movieMap.set(movieId, item.movieId);
        }
      }
    });
    
    const allMovies = Array.from(movieMap.values());
    const total = allMovies.length;
    
    // Paginate
    const movies = allMovies.slice(skip, skip + limit);
    
    console.log(`Returning ${movies.length} unique movies (page ${page} of ${Math.ceil(total / limit)})`);
    
    res.json({
      success: true,
      count: movies.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: movies
    });
  } catch (error) {
    console.error('Error getting history movies:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;

