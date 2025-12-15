const express = require('express');
const router = express.Router();
const Movie = require('../models/movie');
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
    
    // Handle text search separately as aggregation doesn't support $text
    let moviesQuery = Movie.find(filter);
    
    if (req.query.search) {
      filter.$text = { $search: req.query.search };
      moviesQuery = Movie.find(filter).sort({ score: { $meta: 'textScore' } });
    } else {
      // Use aggregation to handle null views properly when no text search
      const moviesAgg = await Movie.aggregate([
        { $match: filter },
        {
          $addFields: {
            viewsForSort: { $ifNull: ['$views', 0] },
            ratingForSort: { $ifNull: ['$rating', 0] }
          }
        },
        { $sort: { ratingForSort: -1, viewsForSort: -1, createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        { $project: { __v: 0, viewsForSort: 0, ratingForSort: 0 } }
      ]);
      
      const total = await Movie.countDocuments(filter);
      
      return res.json({
        success: true,
        count: moviesAgg.length,
        total,
        page,
        pages: Math.ceil(total / limit),
        data: moviesAgg
      });
    }
    
    // For text search, use find() with sort and handle null views in memory
    const allMovies = await moviesQuery.select('-__v');
    const movies = allMovies
      .map(m => m.toObject())
      .sort((a, b) => {
        const ratingA = a.rating || 0;
        const ratingB = b.rating || 0;
        const viewsA = a.views || 0;
        const viewsB = b.views || 0;
        if (ratingB !== ratingA) return ratingB - ratingA;
        if (viewsB !== viewsA) return viewsB - viewsA;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      })
      .slice(skip, skip + limit);
    
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
    const movies = await Movie.aggregate([
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
      if (movie.genres && Array.isArray(movie.genres)) {
        movie.genres.forEach(genre => {
          genreCount[genre] = (genreCount[genre] || 0) + 1;
        });
      }
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
    const movies = await Movie.aggregate([
      {
        $addFields: {
          viewsForSort: { $ifNull: ['$views', 0] },
          ratingForSort: { $ifNull: ['$rating', 0] }
        }
      },
      { $sort: { ratingForSort: -1, viewsForSort: -1 } },
      { $limit: limit },
      { $project: { __v: 0, viewsForSort: 0, ratingForSort: 0 } }
    ]);
    
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

