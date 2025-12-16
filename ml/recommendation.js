const mongoose = require('mongoose');
const History = require('../models/history');
const Movie = require('../models/movie');

const ObjectId = mongoose.Types.ObjectId;

class Recommendation {

  /**
   * Get personalized recommendations for a user
   * Bây giờ ưu tiên: gợi ý phim dựa trên bộ phim người dùng vừa xem
   * (dựa trên mô tả/nội dung của phim đó) thay vì phân tích toàn bộ lịch sử.
   */
  async getRecommendations(userId, limit = 10) {
    try {
      // Lấy bản ghi xem gần nhất của user (view/watch)
      const lastHistory = await History.findOne({ 
        userId,
        action: { $in: ['view', 'watch'] }
      })
        .populate('movieId') // lấy luôn thông tin phim
        .sort({ clickedAt: -1 }) // mới nhất trước
        .lean();

      // Nếu chưa từng xem phim nào -> trả về danh sách phổ biến
      if (!lastHistory || !lastHistory.movieId) {
        return await this.getPopularMovies(limit);
      }

      const baseMovie = lastHistory.movieId;
      const excludeIds = [baseMovie._id.toString()];

      // Gợi ý dựa trên mô tả của phim vừa xem (content-based theo description)
      const descriptionBasedRecs = await this.descriptionBasedRecommendation(
        baseMovie,
        excludeIds,
        limit * 3
      );

      // Nếu vì lý do nào đó không tính được theo mô tả, fallback về gợi ý theo thể loại
      let combinedRecs = descriptionBasedRecs;
      if (!combinedRecs || combinedRecs.length === 0) {
        const userGenres = this.extractGenresFromMovie(baseMovie);
        const contentBasedRecs = await this.contentBasedRecommendation(
          userGenres,
          excludeIds,
          limit * 3
        );
        combinedRecs = contentBasedRecs;
      }

      // Score & sort (đã có score sơ bộ từ description/genre, cộng thêm rating/views...)
      const scoredRecs = await this.scoreRecommendations(combinedRecs, userId);

      return scoredRecs
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(rec => rec.movie);
    } catch (error) {
      console.error('Error getting recommendations:', error);
      return await this.getPopularMovies(limit);
    }
  }

  /**
   * Gợi ý phim tương tự cho một phim cụ thể (dùng cho gợi ý thời gian thực)
   * Ưu tiên dựa trên mô tả (description) của phim đó, fallback sang thể loại.
   */
  async getSimilarForMovie(baseMovie, limit = 10) {
    if (!baseMovie || !baseMovie._id) {
      return [];
    }

    const excludeIds = [baseMovie._id.toString()];

    // Gợi ý dựa trên mô tả phim
    const descriptionBasedRecs = await this.descriptionBasedRecommendation(
      baseMovie,
      excludeIds,
      limit * 3
    );

    let combinedRecs = descriptionBasedRecs;

    // Fallback: dùng thể loại nếu mô tả không đủ thông tin
    if (!combinedRecs || combinedRecs.length === 0) {
      const userGenres = this.extractGenresFromMovie(baseMovie);
      const contentBasedRecs = await this.contentBasedRecommendation(
        userGenres,
        excludeIds,
        limit * 3
      );
      combinedRecs = contentBasedRecs;
    }

    // Score & sort
    const scoredRecs = await this.scoreRecommendations(combinedRecs, null);

    return scoredRecs
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(rec => rec.movie);
  }

  /**
   * Gợi ý content-based dựa trên độ giống nhau về thể loại (genres)
   */
  async contentBasedRecommendation(userGenres, excludeIds, limit) {
    const genreWeights = this.calculateGenreWeights(userGenres);
    
    // Tìm các phim có thể loại trùng với sở thích (genreWeights)
    const movies = await Movie.find({
      _id: { $nin: excludeIds },
      genres: { $in: Object.keys(genreWeights) }
    }).limit(limit * 3);

    // Chấm điểm phim dựa trên mức độ trùng lặp thể loại
    const scored = movies.map(movie => {
      let score = 0;
      movie.genres.forEach(genre => {
        if (genreWeights[genre]) {
          score += genreWeights[genre];
        }
      });
      // Chuẩn hóa theo số lượng thể loại của phim
      score = score / Math.max(movie.genres.length, 1);
      // Cộng thêm điểm theo rating và độ phổ biến (views)
      score += (movie.rating || 5) * 0.1;
      score += Math.log((movie.views || 0) + 1) * 0.05;
      return { movie, score };
    });

    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Content-based theo mô tả phim (description)
   * Ý tưởng đơn giản: so khớp token giữa mô tả phim đang xem và các phim khác (Jaccard)
   */
  async descriptionBasedRecommendation(baseMovie, excludeIds, limit) {
    if (!baseMovie || !baseMovie.description) {
      return [];
    }

    // Tokenize mô tả phim gốc
    const baseTokens = this.tokenizeText(baseMovie.description);
    if (baseTokens.size === 0) {
      return [];
    }

    // Lấy danh sách phim khác để so sánh
    const candidates = await Movie.find({
      _id: { $nin: excludeIds }
    }).select('title description genres rating views year poster').lean();

    const scored = [];

    for (const movie of candidates) {
      if (!movie.description) continue;

      const movieTokens = this.tokenizeText(movie.description);
      if (movieTokens.size === 0) continue;

      // Jaccard similarity giữa 2 tập token
      const similarity = this.jaccardSimilarity(baseTokens, movieTokens);
      if (similarity <= 0) continue;

      // Base score = độ giống mô tả
      let score = similarity * 10; // scale lên một chút để dễ kết hợp

      // Nhẹ nhàng thưởng thêm nếu trùng thể loại
      if (Array.isArray(baseMovie.genres) && Array.isArray(movie.genres)) {
        const overlap = movie.genres.filter(g => baseMovie.genres.includes(g)).length;
        if (overlap > 0) {
          score += overlap * 0.5;
        }
      }

      scored.push({ movie, score });
    }

    // Trả về top theo score mô tả
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Tokenize text: chuyển về lower-case, bỏ ký tự đặc biệt, tách từ, loại bỏ từ quá ngắn
   */
  tokenizeText(text) {
    if (!text || typeof text !== 'string') return new Set();
    const cleaned = text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '') // bỏ dấu tiếng Việt
      .replace(/[^a-z0-9\s]/g, ' ');

    const tokens = cleaned
      .split(/\s+/)
      .filter(t => t.length >= 3); // bỏ từ quá ngắn / ít thông tin

    return new Set(tokens);
  }

  /**
   * Jaccard similarity giữa 2 tập token
   */
  jaccardSimilarity(setA, setB) {
    if (!setA || !setB || setA.size === 0 || setB.size === 0) return 0;

    let intersection = 0;
    for (const token of setA) {
      if (setB.has(token)) intersection++;
    }

    const union = setA.size + setB.size - intersection;
    if (union === 0) return 0;

    return intersection / union;
  }

  /**
   * Lấy thống kê thể loại từ một phim (dùng cho fallback content-based)
   */
  extractGenresFromMovie(movie) {
    const genreCount = {};
    if (movie && Array.isArray(movie.genres)) {
      movie.genres.forEach(g => {
        genreCount[g] = (genreCount[g] || 0) + 1;
      });
    }
    return genreCount;
  }

  /**
   * Tính trọng số cho từng thể loại dựa trên tần suất xuất hiện
   */
  calculateGenreWeights(genreCount) {
    const total = Object.values(genreCount).reduce((a, b) => a + b, 0);
    const weights = {};
    
    Object.keys(genreCount).forEach(genre => {
      weights[genre] = genreCount[genre] / total;
    });

    return weights;
  }

  /**
   * Chấm điểm lại danh sách gợi ý với các yếu tố bổ sung
   * (rating, độ phổ biến, độ mới của phim)
   */
  async scoreRecommendations(recommendations, userId) {
    return recommendations.map(({ movie, score, type }) => {
      // Điểm gốc tính từ mô tả/thể loại, sau đó cộng thêm các yếu tố khác
      let finalScore = score;
      
      // Cộng thêm điểm theo rating
      if (movie.rating) {
        finalScore += movie.rating * 0.2;
      }
      
      // Cộng thêm điểm theo độ phổ biến (views), dùng log để tránh lệch quá nhiều
      finalScore += Math.log((movie.views || 0) + 1) * 0.1;
      
      // Cộng thêm điểm nhẹ cho phim mới hơn (năm phát hành gần hiện tại)
      if (movie.year) {
        const currentYear = new Date().getFullYear();
        const age = currentYear - movie.year;
        if (age < 5) {
          finalScore += 0.1 * (5 - age);
        }
      }
      
      return { movie, score: finalScore, type };
    });
  }

  /**
   * Lấy danh sách phim phổ biến làm phương án dự phòng
   * (lọc theo rating giảm dần, sau đó tới views)
   */
  async getPopularMovies(limit) {
    return await Movie.aggregate([
      {
        $addFields: {
          viewsForSort: { $ifNull: ['$views', 0] },
          ratingForSort: { $ifNull: ['$rating', 0] }
        }
      },
      { $sort: { ratingForSort: -1, viewsForSort: -1 } },
      { $limit: limit },
      { $project: { viewsForSort: 0, ratingForSort: 0 } }
    ]);
  }
}

module.exports = Recommendation;

