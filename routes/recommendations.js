const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect } = require('../middleware/auth');
const History = require('../models/history');
const Movie = require('../models/movie');
const Recommendation = require('../ml/recommendation');

// @route   GET /api/recommendations
// @desc    Lấy danh sách phim gợi ý cho người dùng (dựa trên phim xem gần nhất)
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Lấy lịch sử xem của người dùng (chỉ tính action view/watch, không tính click)
    const userHistory = await History.find({ 
      userId: req.user.id,
      action: { $in: ['view', 'watch'] }
    })
      .populate('movieId')
      .sort({ clickedAt: -1 });
    
    console.log(`Getting recommendations for user ${req.user.id}, viewing history count: ${userHistory.length}, page: ${page}`);
    
    if (userHistory.length === 0) {
      // Nếu người dùng chưa xem phim nào thì trả về top 20 phim có rating cao
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
    
    // Gọi engine gợi ý (ML) để sinh danh sách gợi ý
    try {
      const recommendation = new Recommendation();
      // Lấy số lượng lớn hơn để có thể tự phân trang ở tầng API
      const allRecommendations = await recommendation.getRecommendations(
        req.user.id,
        limit * 10 // Lấy nhiều hơn để có thể paginate
      );
      
      // Đảm bảo recommendations là array
      const safeRecommendations = Array.isArray(allRecommendations) ? allRecommendations : [];
      const total = safeRecommendations.length;
      
      // Tự phân trang trên mảng kết quả đã sinh ra
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
// @desc    Get similar movies to a specific movie (content-based theo mô tả phim)
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

    // Dùng Recommendation engine để gợi ý theo mô tả + thể loại của chính phim này
    const recommendation = new Recommendation();
    const similarMovies = await recommendation.getSimilarForMovie(movie, limit);

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

