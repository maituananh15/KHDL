const express = require('express');
const router = express.Router();

// Simple placeholder evaluation endpoint.
// In production, plug in real evaluation results from offline jobs.
router.get('/', async (_req, res) => {
  try {
    res.json({
      success: true,
      data: {
        rmse: null,
        mae: null,
        precisionAtK: null,
        recallAtK: null,
        note: 'Chưa có kết quả tính toán. Hãy chạy script đánh giá và cập nhật API này.'
      }
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

