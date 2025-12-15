const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  originalTitle: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  genres: {
    type: [String],
    default: []
  },
  year: {
    type: Number,
    min: 1900,
    max: new Date().getFullYear() + 1
  },
  duration: {
    type: Number, // minutes
    min: 0
  },
  rating: {
    type: Number,
    min: 0,
    max: 10,
    default: 0
  },
  director: {
    type: String,
    default: ''
  },
  cast: {
    type: [String],
    default: []
  },
  country: {
    type: String,
    default: ''
  },
  language: {
    type: String,
    default: ''
  },
  poster: {
    type: String,
    default: ''
  },
  trailer: {
    type: String,
    default: ''
  },
  sourceUrl: {
    type: String,
    required: true
  },
  tags: {
    type: [String],
    default: []
  },
  views: {
    type: Number,
    default: 0
  },
  clickCount: {
    type: Number,
    default: 0
  },
  tmdbId: {
    type: Number,
    unique: true,
    sparse: true // Cho phép null nhưng unique khi có giá trị
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
movieSchema.index({ title: 'text', description: 'text' });
movieSchema.index({ genres: 1 });
movieSchema.index({ rating: -1 });
movieSchema.index({ clickCount: -1 });
movieSchema.index({ tmdbId: 1 });

module.exports = mongoose.model('Movie', movieSchema);


