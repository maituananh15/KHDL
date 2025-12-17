require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const connectDB = require('../config/database');
const UserRating = require('../models/userRating');
const Recommendation = require('../ml/recommendation');

(async () => {
  try {
    await connectDB();

    const MIN_RATINGS = 3;      // chỉ lấy user có ít nhất 3 rating
    const LIMIT_USERS = 200;    // số user tối đa dùng để đánh giá
    const K = 10;               // số lượng gợi ý / user
    const RATING_THRESHOLD = 3; // phim được coi là "relevant" nếu user rating >= 3

    const recommender = new Recommendation();

    // Lấy danh sách user có đủ rating
    const usersAgg = await UserRating.aggregate([
      {
        $group: {
          _id: '$userId',
          count: { $sum: 1 },
          movies: {
            $push: {
              movieId: '$movieId',
              rating: '$rating'
            }
          }
        }
      },
      { $match: { count: { $gte: MIN_RATINGS } } },
      { $limit: LIMIT_USERS }
    ]);

    const allRecommendations = {};
    const allRelevantItems = {};

    for (const u of usersAgg) {
      const userId = u._id.toString();

      // Gọi recommender để lấy danh sách gợi ý cho user (danh sách phim)
      const recMovies = await recommender.getRecommendations(userId, K);
      const recIds = recMovies.map(m => m._id.toString());

      // Xác định phim "relevant" dựa trên rating của chính user
      const relevantIds = (u.movies || [])
        .filter(m => typeof m.rating === 'number' && m.rating >= RATING_THRESHOLD)
        .map(m => m.movieId.toString());

      if (recIds.length && relevantIds.length) {
        allRecommendations[userId] = recIds;
        allRelevantItems[userId] = relevantIds;
      }
    }

    const output = {
      k: K,
      rating_threshold: RATING_THRESHOLD,
      min_ratings: MIN_RATINGS,
      user_count: Object.keys(allRecommendations).length,
      all_recommendations: allRecommendations,
      all_relevant_items: allRelevantItems
    };

    const outPath = path.join(process.cwd(), 'ml', 'eval_data_user_ratings.json');
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');

    console.log('Đã export dữ liệu đánh giá từ user_ratings tới:', outPath);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Lỗi khi export dữ liệu đánh giá từ user_ratings:', error);
    process.exit(1);
  }
})();


