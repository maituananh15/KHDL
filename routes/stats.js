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
// @desc    Get top items by rating
// @access  Public
router.get('/top-items', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    // Top theo rating - xử lý cả string và number rating
    const topByRating = await Movie.aggregate([
      {
        $match: {
          rating: { $exists: true, $ne: null }
        }
      },
      {
        $addFields: {
          // Convert rating to number nếu là string
          ratingNum: {
            $cond: [
              { $eq: [{ $type: '$rating' }, 'string'] },
              { 
                $convert: {
                  input: '$rating',
                  to: 'double',
                  onError: 0,
                  onNull: 0
                }
              },
              { $ifNull: ['$rating', 0] }
            ]
          },
          viewsForSort: { $ifNull: ['$views', 0] }
        }
      },
      {
        $match: {
          ratingNum: { $gt: 0 } // Chỉ lấy phim có rating > 0
        }
      },
      { 
        $sort: { 
          ratingNum: -1,  // Sắp xếp theo rating giảm dần
          viewsForSort: -1 // Nếu rating bằng nhau, sắp xếp theo views
        } 
      },
      { $limit: limit },
      { 
        $project: { 
          title: 1, 
          rating: '$ratingNum', // Dùng rating đã convert sang number
          views: 1,
          _id: 1
        } 
      }
    ]);
    
    console.log(`✓ Top ${topByRating.length} movies by rating retrieved`);
    
    res.json({
      success: true,
      data: {
        byRating: topByRating
      }
    });
  } catch (error) {
    console.error('Error getting top items:', error);
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
    
    const totalViews = await Movie.aggregate([
      { 
        $group: { 
          _id: null, 
          totalViews: { 
            $sum: { 
              $ifNull: ['$views', 0] 
            } 
          } 
        } 
      }
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
        totalViews: totalViews[0]?.totalViews || 0,
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

