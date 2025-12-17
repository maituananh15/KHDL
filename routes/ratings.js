const express = require('express');
const router = express.Router();

const UserRating = require('../models/userRating');
const Movie = require('../models/movie');
const { protect } = require('../middleware/auth');

// @route   POST /api/ratings
// @desc    Tạo hoặc cập nhật rating cho một bộ phim
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { movieId, rating, comment } = req.body;

    if (!movieId || typeof rating === 'undefined') {
      return res.status(400).json({
        success: false,
        message: 'movieId và rating là bắt buộc'
      });
    }

    if (rating < 0.5 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'rating phải nằm trong khoảng 0.5 - 5'
      });
    }

    const movie = await Movie.findById(movieId);
    if (!movie) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy phim'
      });
    }

    const userId = req.user.id;

    // upsert: nếu đã có rating thì cập nhật, nếu chưa thì tạo mới
    const userRating = await UserRating.findOneAndUpdate(
      { userId, movieId },
      { rating, comment: comment || '' },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      success: true,
      data: userRating
    });
  } catch (error) {
    console.error('Error creating/updating rating:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lưu rating',
      error: error.message
    });
  }
});

// @route   GET /api/ratings/movie/:movieId
// @desc    Lấy danh sách rating cho một bộ phim
// @access  Public
router.get('/movie/:movieId', async (req, res) => {
  try {
    const { movieId } = req.params;

    const ratings = await UserRating.find({ movieId })
      .populate('userId', 'username')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: ratings.length,
      data: ratings
    });
  } catch (error) {
    console.error('Error getting ratings for movie:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy rating',
      error: error.message
    });
  }
});

// @route   GET /api/ratings/me
// @desc    Lấy các rating của chính user đang đăng nhập
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const ratings = await UserRating.find({ userId: req.user.id })
      .populate('movieId', 'title poster')
      .sort({ updatedAt: -1 });

    return res.json({
      success: true,
      count: ratings.length,
      data: ratings
    });
  } catch (error) {
    console.error('Error getting user ratings:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy rating của user',
      error: error.message
    });
  }
});

module.exports = router;


