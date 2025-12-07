const express = require('express');
const router = express.Router();
const Movie = require('../models/Movie');

// @route   GET /api/stats/rating-distribution
// @desc    Get rating distribution data
// @access  Public
router.get('/rating-distribution', async (req, res) => {
  try {
    const movies = await Movie.find({ rating: { $exists: true, $ne: null } })
      .select('rating');
    
    // Tạo bins cho histogram (0-10, mỗi bin 0.5)
    const bins = [];
    for (let i = 0; i <= 20; i++) {
      bins.push(i * 0.5);
    }
    
    const distribution = new Array(bins.length - 1).fill(0);
    
    movies.forEach(movie => {
      if (movie.rating != null) {
        const binIndex = Math.min(
          Math.floor(movie.rating / 0.5),
          distribution.length - 1
        );
        distribution[binIndex]++;
      }
    });
    
    // Tạo labels cho bins
    const labels = [];
    for (let i = 0; i < bins.length - 1; i++) {
      labels.push(`${bins[i].toFixed(1)}-${bins[i + 1].toFixed(1)}`);
    }
    
    res.json({
      success: true,
      data: {
        labels,
        values: distribution
      }
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

// @route   GET /api/stats/genre-frequency
// @desc    Get genre frequency data
// @access  Public
router.get('/genre-frequency', async (req, res) => {
  try {
    const movies = await Movie.find().select('genres');
    const genreCount = {};
    
    movies.forEach(movie => {
      if (movie.genres && Array.isArray(movie.genres)) {
        movie.genres.forEach(genre => {
          genreCount[genre] = (genreCount[genre] || 0) + 1;
        });
      }
    });
    
    // Sắp xếp và lấy top 15
    const genreStats = Object.entries(genreCount)
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
    
    res.json({
      success: true,
      data: genreStats
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

// @route   GET /api/stats/top-items
// @desc    Get top items by rating and clicks
// @access  Public
router.get('/top-items', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    // Top theo rating
    const topByRating = await Movie.find()
      .sort({ rating: -1, clickCount: -1 })
      .limit(limit)
      .select('title rating clickCount');
    
    // Top theo clicks
    const topByClicks = await Movie.find()
      .sort({ clickCount: -1, rating: -1 })
      .limit(limit)
      .select('title rating clickCount');
    
    res.json({
      success: true,
      data: {
        byRating: topByRating,
        byClicks: topByClicks
      }
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

// @route   GET /api/stats/summary
// @desc    Get summary statistics
// @access  Public
router.get('/summary', async (req, res) => {
  try {
    const totalMovies = await Movie.countDocuments();
    const avgRating = await Movie.aggregate([
      { $match: { rating: { $exists: true, $ne: null } } },
      { $group: { _id: null, avgRating: { $avg: '$rating' } } }
    ]);
    
    const totalClicks = await Movie.aggregate([
      { $group: { _id: null, totalClicks: { $sum: '$clickCount' } } }
    ]);
    
    const genreCount = await Movie.aggregate([
      { $unwind: '$genres' },
      { $group: { _id: '$genres' } },
      { $count: 'count' }
    ]);
    
    res.json({
      success: true,
      data: {
        totalMovies,
        avgRating: avgRating[0]?.avgRating || 0,
        totalClicks: totalClicks[0]?.totalClicks || 0,
        uniqueGenres: genreCount[0]?.count || 0
      }
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

