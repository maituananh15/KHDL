require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const connectDB = require('../config/database');
const History = require('../models/history');
const Movie = require('../models/movie');
const Recommendation = require('../ml/recommendation');

(async () => {
  try {
    await connectDB();

    const MIN_HISTORY = 3;      // chỉ lấy user có ít nhất 3 lần xem
    const LIMIT_USERS = 200;    // số user tối đa dùng để đánh giá
    const K = 10;               // số lượng gợi ý / user
    const RATING_THRESHOLD = 7; // phim được coi là "tốt" nếu rating TMDB >= 7

    const recommender = new Recommendation();

    // Lấy danh sách user có đủ lịch sử xem
    const usersAgg = await History.aggregate([
      { $match: { action: { $in: ['view', 'watch'] } } },
      {
        $group: {
          _id: '$userId',
          count: { $sum: 1 },
          movies: { $addToSet: '$movieId' }
        }
      },
      { $match: { count: { $gte: MIN_HISTORY } } },
      { $limit: LIMIT_USERS }
    ]);

    const allRecommendations = {};
    const allRelevantItems = {};

    for (const u of usersAgg) {
      const userId = u._id.toString();

      // Gọi recommender để lấy danh sách gợi ý cho user (danh sách phim)
      const recMovies = await recommender.getRecommendations(userId, K);
      const recIds = recMovies.map(m => m._id.toString());

      // Xác định phim "relevant" dựa trên rating TMDB (movie.rating)
      const historyMovieIds = (u.movies || []).map(m => m.toString());
      const historyMovies = await Movie.find({ _id: { $in: historyMovieIds } })
        .select('_id rating')
        .lean();

      const relevantIds = historyMovies
        .filter(m => typeof m.rating === 'number' && m.rating >= RATING_THRESHOLD)
        .map(m => m._id.toString());

      if (recIds.length && relevantIds.length) {
        allRecommendations[userId] = recIds;
        allRelevantItems[userId] = relevantIds;
      }
    }

    const output = {
      k: K,
      rating_threshold: RATING_THRESHOLD,
      min_history: MIN_HISTORY,
      user_count: Object.keys(allRecommendations).length,
      all_recommendations: allRecommendations,
      all_relevant_items: allRelevantItems
    };

    const outPath = path.join(process.cwd(), 'ml', 'eval_data.json');
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');

    console.log('Đã export dữ liệu đánh giá mô hình tới:', outPath);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Lỗi khi export dữ liệu đánh giá từ lịch sử:', error);
    process.exit(1);
  }
})();


