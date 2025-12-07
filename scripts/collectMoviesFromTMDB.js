const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const Movie = require('../models/Movie');
require('dotenv').config();
const connectDB = require('../config/database');

const TMDB_API_KEY = process.env.TMDB_API_KEY || '';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// Tạo thư mục lưu ảnh
const POSTERS_DIR = path.join(__dirname, '..', 'public', 'images', 'posters');
if (!fs.existsSync(POSTERS_DIR)) {
  fs.mkdirSync(POSTERS_DIR, { recursive: true });
}

/**
 * Download ảnh poster từ URL
 */
async function downloadPoster(posterUrl, movieId, title) {
  if (!posterUrl) return null;

  try {
    const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const fileName = `${movieId}_${safeTitle}.jpg`;
    const filePath = path.join(POSTERS_DIR, fileName);

    if (fs.existsSync(filePath)) {
      return `/images/posters/${fileName}`;
    }

    const fullUrl = posterUrl.startsWith('http') ? posterUrl : `${TMDB_IMAGE_BASE_URL}${posterUrl}`;
    const response = await axios.get(fullUrl, {
      responseType: 'stream',
      timeout: 15000
    });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(`/images/posters/${fileName}`));
      writer.on('error', () => reject(null));
    });
  } catch (error) {
    console.error(`  ✗ Lỗi download poster: ${error.message}`);
    // Nếu download thất bại, trả về URL remote
    return posterUrl.startsWith('http') ? posterUrl : `${TMDB_IMAGE_BASE_URL}${posterUrl}`;
  }
}

/**
 * Lấy phim từ TMDb API (phổ biến, top rated, etc.)
 */
async function fetchMoviesFromTMDB(page = 1, sortBy = 'popularity.desc') {
  if (!TMDB_API_KEY || TMDB_API_KEY.trim() === '') {
    throw new Error('TMDB_API_KEY chưa được cấu hình trong file .env');
  }

  try {
    const url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&sort_by=${sortBy}&page=${page}&language=vi-VN&vote_count.gte=100`;
    const response = await axios.get(url, { timeout: 10000 });
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      throw new Error('TMDB_API_KEY không hợp lệ. Vui lòng kiểm tra lại.');
    }
    throw error;
  }
}

/**
 * Chuyển đổi dữ liệu từ TMDb sang format của Movie model
 */
function convertTMDBToMovie(tmdbMovie) {
  const genresMap = {
    28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy',
    80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
    14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
    9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi', 10770: 'TV Movie',
    53: 'Thriller', 10752: 'War', 37: 'Western'
  };

  const genres = (tmdbMovie.genre_ids || []).map(id => genresMap[id] || 'Unknown').filter(g => g !== 'Unknown');
  
  return {
    title: tmdbMovie.title || tmdbMovie.original_title || 'Unknown',
    originalTitle: tmdbMovie.original_title || tmdbMovie.title || 'Unknown',
    description: tmdbMovie.overview || 'Không có mô tả.',
    genres: genres.length > 0 ? genres : ['Drama'],
    year: tmdbMovie.release_date ? new Date(tmdbMovie.release_date).getFullYear() : null,
    duration: null, // TMDb không có duration trong discover API
    rating: tmdbMovie.vote_average ? (tmdbMovie.vote_average).toFixed(1) : 5.0,
    director: 'Unknown', // Cần gọi API khác để lấy director
    cast: [],
    country: 'Unknown',
    language: tmdbMovie.original_language || 'en',
    poster: tmdbMovie.poster_path || null,
    trailer: null,
    sourceUrl: `https://www.themoviedb.org/movie/${tmdbMovie.id}`,
    tags: genres.slice(0, 3),
    views: Math.floor(Math.random() * 50000),
    clickCount: 0,
    tmdbId: tmdbMovie.id // Lưu TMDb ID để reference sau
  };
}

/**
 * Lấy thông tin chi tiết phim từ TMDb (để lấy director, cast, duration)
 */
async function fetchMovieDetails(tmdbId) {
  if (!TMDB_API_KEY) return null;

  try {
    const url = `${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=vi-VN&append_to_response=credits`;
    const response = await axios.get(url, { timeout: 10000 });
    return response.data;
  } catch (error) {
    return null;
  }
}

/**
 * Thu thập phim từ TMDb
 */
async function collectMoviesFromTMDB(totalMovies = 2000) {
  try {
    await connectDB();
    console.log('='.repeat(60));
    console.log('BẮT ĐẦU THU THẬP PHIM TỪ TMDb');
    console.log('='.repeat(60));

    if (!TMDB_API_KEY || TMDB_API_KEY.trim() === '') {
      throw new Error('\n❌ TMDB_API_KEY chưa được cấu hình!\nVui lòng thêm vào file .env:\nTMDB_API_KEY=your_api_key_here\n\nLấy API key miễn phí tại: https://www.themoviedb.org/settings/api');
    }

    console.log(`\n✓ API Key đã được cấu hình`);
    console.log(`Đang thu thập ${totalMovies} phim...\n`);

    let savedCount = 0;
    let skippedCount = 0;
    let currentPage = 1;
    const moviesPerPage = 20;
    const totalPages = Math.ceil(totalMovies / moviesPerPage);

    // Thu thập từ nhiều nguồn để đa dạng
    const sortOptions = [
      'popularity.desc',      // Phim phổ biến
      'vote_average.desc',    // Đánh giá cao
      'release_date.desc',    // Mới nhất
      'revenue.desc'          // Doanh thu cao
    ];

    while (savedCount < totalMovies) {
      const sortBy = sortOptions[Math.floor((currentPage - 1) / (totalPages / sortOptions.length)) % sortOptions.length];
      
      try {
        console.log(`\n[Trang ${currentPage}] Đang lấy phim (${sortBy})...`);
        const data = await fetchMoviesFromTMDB(currentPage, sortBy);

        if (!data.results || data.results.length === 0) {
          console.log('  ⚠ Không còn phim nào. Dừng thu thập.');
          break;
        }

        for (const tmdbMovie of data.results) {
          if (savedCount >= totalMovies) break;

          try {
            // Kiểm tra phim đã tồn tại chưa
            const existingMovie = await Movie.findOne({ 
              $or: [
                { tmdbId: tmdbMovie.id },
                { title: tmdbMovie.title, year: new Date(tmdbMovie.release_date || 0).getFullYear() }
              ]
            });

            if (existingMovie) {
              skippedCount++;
              continue;
            }

            // Chuyển đổi dữ liệu
            const movieData = convertTMDBToMovie(tmdbMovie);

            // Lấy thông tin chi tiết (để có director, cast, duration)
            const details = await fetchMovieDetails(tmdbMovie.id);
            if (details) {
              movieData.duration = details.runtime || null;
              movieData.country = details.production_countries && details.production_countries.length > 0 
                ? details.production_countries[0].iso_3166_1 : 'Unknown';
              
              // Lấy director
              if (details.credits && details.credits.crew) {
                const director = details.credits.crew.find(p => p.job === 'Director');
                if (director) movieData.director = director.name;
              }

              // Lấy cast (top 4)
              if (details.credits && details.credits.cast) {
                movieData.cast = details.credits.cast.slice(0, 4).map(actor => actor.name);
              }
            }

            // Tạo movie trong database
            const movie = await Movie.create(movieData);

            // Download poster
            if (movieData.poster) {
              try {
                const posterPath = await downloadPoster(movieData.poster, movie._id.toString(), movie.title);
                if (posterPath) {
                  movie.poster = posterPath;
                  await movie.save();
                }
              } catch (error) {
                // Nếu download thất bại, dùng URL từ TMDb
                movie.poster = movieData.poster.startsWith('http') 
                  ? movieData.poster 
                  : `${TMDB_IMAGE_BASE_URL}${movieData.poster}`;
                await movie.save();
              }
            }

            savedCount++;
            console.log(`  ✓ [${savedCount}/${totalMovies}] ${movie.title} (${movie.year || 'N/A'})`);

            // Delay để tránh rate limit
            await new Promise(resolve => setTimeout(resolve, 200));

          } catch (error) {
            console.error(`  ✗ Lỗi lưu phim "${tmdbMovie.title}":`, error.message);
            skippedCount++;
          }
        }

        currentPage++;
        
        // Delay giữa các trang
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`\n✗ Lỗi lấy trang ${currentPage}:`, error.message);
        if (error.message.includes('không hợp lệ') || error.message.includes('chưa được cấu hình')) {
          process.exit(1);
        }
        currentPage++;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('HOÀN THÀNH THU THẬP!');
    console.log('='.repeat(60));
    console.log(`✓ Đã lưu: ${savedCount} phim`);
    console.log(`⊘ Đã bỏ qua: ${skippedCount} phim (trùng lặp hoặc lỗi)`);
    console.log(`📊 Tổng cộng: ${savedCount + skippedCount} phim đã xử lý`);
    console.log(`\n✨ TẤT CẢ PHIM ĐỀU CÓ POSTER!`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ LỖI:', error.message);
    process.exit(1);
  }
}

// Nếu chạy trực tiếp
if (require.main === module) {
  const totalMovies = parseInt(process.argv[2]) || 2000;
  collectMoviesFromTMDB(totalMovies);
}

module.exports = { collectMoviesFromTMDB };






