const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// @route   GET /api/evaluation
// @desc    Lấy kết quả đánh giá mô hình recommendation
// @access  Public
router.get('/', async (_req, res) => {
  try {
    // Đường dẫn tới file JSON chứa kết quả đánh giá do script Python ghi ra
    const resultPath = path.join(process.cwd(), 'evaluation_result.json');

    let metrics;

    if (fs.existsSync(resultPath)) {
      // Đọc kết quả đánh giá thực tế từ file JSON
      const raw = fs.readFileSync(resultPath, 'utf8');
      const parsed = JSON.parse(raw || '{}');

      // Chuẩn hoá lại key cho frontend
      metrics = {
        rmse: parsed.rmse ?? null,
        mae: parsed.mae ?? null,
        precisionAtK: parsed.precisionAtK ?? parsed.precision_at_k ?? null,
        recallAtK: parsed.recallAtK ?? parsed.recall_at_k ?? null,
        k: parsed.k ?? 10,
        updatedAt: parsed.updatedAt || parsed.updated_at || new Date().toISOString(),
        note:
          parsed.note 
      };
    } else {
      // Nếu chưa có file kết quả, trả về giá trị mẫu để UI vẫn hiển thị được
      metrics = null;
    }

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error getting evaluation metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy kết quả đánh giá mô hình',
      error: error.message
    });
  }
});

module.exports = router;


