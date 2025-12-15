const express = require('express');
const router = express.Router();

// Simple placeholder evaluation endpoint.
// In production, plug in real evaluation results from offline jobs.
router.get('/', async (_req, res) => {
  try {
    // Các giá trị mẫu — thay bằng kết quả thực tế sau khi bạn chạy đánh giá offline
    const metrics = {
      rmse: 0.89,
      mae: 0.71,
      precisionAtK: 0.42,
      recallAtK: 0.31,
      k: 10,
      updatedAt: new Date().toISOString(),
      note: 'Các số liệu mẫu. Cập nhật bằng kết quả đánh giá thực tế khi có.'
    };

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error getting evaluation metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching evaluation metrics',
      error: error.message
    });
  }
});

module.exports = router;

