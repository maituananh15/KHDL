const mongoose = require('mongoose');

const HistorySchema = new mongoose.Schema(
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
    action: {
      type: String,
      enum: ['view', 'watch'],
      default: 'view'
    },
    duration: {
      type: Number,
      default: 0
    },
    metadata: {
      type: Object,
      default: {}
    },
    clickedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('History', HistorySchema);

