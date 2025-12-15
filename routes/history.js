const express = require('express');
const router = express.Router();
const History = require('../models/history');
const Movie = require('../models/movie');
const { protect } = require('../middleware/auth');

// @route   POST /api/history/view
// @desc    Record a view/watch on a movie
// @access  Private
router.post('/view', protect, async (req, res) => {
  try {
    const { movieId, duration, metadata } = req.body;
    
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
    
    // Create viewing history (only for actual views, not clicks)
    const viewHistory = await History.create({
      userId: req.user.id,
      movieId,
      duration: duration || 0,
      action: 'view',
      metadata: metadata || {}
    });
    
    console.log(`✓ View recorded: user ${req.user.id}, movie ${movieId}`);
    
    res.status(201).json({
      success: true,
      data: viewHistory
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
// @desc    Get user's viewing history
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Only get viewing history (action = 'view' or 'watch')
    const history = await History.find({ 
      userId: req.user.id,
      action: { $in: ['view', 'watch'] }
    })
      .populate('movieId', 'title poster rating genres year')
      .sort({ clickedAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await History.countDocuments({ 
      userId: req.user.id,
      action: { $in: ['view', 'watch'] }
    });
    
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
// @desc    Get unique movies from user's viewing history with pagination
// @access  Private
router.get('/movies', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    console.log(`Getting viewing history movies for user ${req.user.id}, page: ${page}`);
    
    // Only get viewing history (action = 'view' or 'watch')
    const history = await History.find({ 
      userId: req.user.id,
      action: { $in: ['view', 'watch'] }
    })
      .populate('movieId')
      .sort({ clickedAt: -1 });
    
    console.log(`Found ${history.length} viewing history records`);
    
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
    console.error('Error getting viewing history movies:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;


