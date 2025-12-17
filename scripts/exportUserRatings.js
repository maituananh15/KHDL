require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const connectDB = require('../config/database');
const UserRating = require('../models/userRating');

(async () => {
  try {
    await connectDB();

    // Lấy tất cả rating (có thể giới hạn nếu dữ liệu rất lớn)
    const ratings = await UserRating.find({})
      .select('userId movieId rating')
      .lean();

    const userItemRatings = {};

    ratings.forEach(r => {
      const userId = r.userId.toString();
      const movieId = r.movieId.toString();

      if (!userItemRatings[userId]) {
        userItemRatings[userId] = {};
      }

      userItemRatings[userId][movieId] = r.rating;
    });

    const output = {
      user_item_ratings: userItemRatings
    };

    const outPath = path.join(process.cwd(), 'ml', 'user_ratings.json');
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');

    console.log('Đã export dữ liệu rating người dùng tới:', outPath);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Lỗi khi export user ratings:', error);
    process.exit(1);
  }
})();


