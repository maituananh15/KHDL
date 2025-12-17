const mongoose = require('mongoose');

const UserRatingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    movieId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Movie',
      required: true
    },
    rating: {
      type: Number,
      min: 0.5,
      max: 5,
      required: true
    },
    comment: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true,
    collection: 'user_ratings'
  }
);

// Mỗi user chỉ được rating một lần cho một movie
UserRatingSchema.index({ userId: 1, movieId: 1 }, { unique: true });

module.exports = mongoose.model('UserRating', UserRatingSchema);


