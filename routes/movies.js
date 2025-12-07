const express = require('express');
const router = express.Router();
const Movie = require('../models/Movie');
const { protect } = require('../middleware/auth');

// @route   GET /api/movies
// @desc    Get all movies with pagination and filtering
// @access  Public
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const filter = {};
    
    // Filter by genre
    if (req.query.genre) {
      filter.genres = { $in: [req.query.genre] };
    }
    
    // Filter by year
    if (req.query.year) {
      filter.year = parseInt(req.query.year);
    }
    
    // Search
    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }
    
    const movies = await Movie.find(filter)
      .sort({ clickCount: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-__v');
    
    const total = await Movie.countDocuments(filter);
    
    res.json({
      success: true,
      count: movies.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: movies
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

// @route   GET /api/movies/:id
// @desc    Get single movie by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    
    if (!movie) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }
    
    res.json({
      success: true,
      data: movie
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

// @route   GET /api/movies/stats/popular
// @desc    Get popular movies
// @access  Public
router.get('/stats/popular', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const movies = await Movie.find()
      .sort({ clickCount: -1, rating: -1 })
      .limit(limit);
    
    res.json({
      success: true,
      count: movies.length,
      data: movies
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/movies/stats/genres
// @desc    Get genre statistics
// @access  Public
router.get('/stats/genres', async (req, res) => {
  try {
    const movies = await Movie.find();
    const genreCount = {};
    
    movies.forEach(movie => {
      movie.genres.forEach(genre => {
        genreCount[genre] = (genreCount[genre] || 0) + 1;
      });
    });
    
    const genreStats = Object.entries(genreCount)
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count);
    
    res.json({
      success: true,
      data: genreStats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/movies/stats/trending
// @desc    Get trending movies by rating
// @access  Public
router.get('/stats/trending', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const movies = await Movie.find()
      .sort({ rating: -1, clickCount: -1 })
      .limit(limit)
      .select('-__v');
    
    res.json({
      success: true,
      count: movies.length,
      data: movies
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;

