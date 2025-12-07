# HỆ THỐNG GỢI Ý PHIM (MOVIE RECOMMENDATION SYSTEM)

## Mô tả dự án
Hệ thống gợi ý phim với các tính năng:
- Thu thập dữ liệu phim từ website
- Lưu trữ trong MongoDB với Mongoose
- Đăng nhập/Đăng ký người dùng
- Lưu lịch sử click của người dùng
- Gợi ý phim dựa trên lịch sử xem

## Cấu trúc dự án
```
├── server.js                 # Express server chính
├── config/                   # Cấu hình database
├── models/                   # Mongoose models
├── routes/                   # API routes
├── middleware/               # Authentication middleware
├── scripts/                  # Scripts thu thập và xử lý dữ liệu
│   ├── collectMovies.js     # Thu thập dữ liệu phim
│   ├── processData.py       # Xử lý và làm sạch dữ liệu
│   └── trainModel.py        # Huấn luyện mô hình
├── ml/                      # Machine learning models
│   ├── recommendation.py    # Mô hình gợi ý
│   └── evaluation.py        # Đánh giá mô hình
├── public/                  # Frontend files
│   ├── index.html
│   ├── css/
│   └── js/
└── data/                    # Dữ liệu
    ├── raw/
    ├── processed/
    └── visualizations/
```

## Cài đặt

### 1. Cài đặt Node.js dependencies
```bash
npm install
```

### 2. Cài đặt Python dependencies
```bash
pip install -r requirements.txt
```

### 3. Cấu hình MongoDB
Tạo file `.env`:
```
MONGODB_URI=mongodb://localhost:27017/movie_recommendation
JWT_SECRET=your_secret_key_here
PORT=3000
TMDB_API_KEY=your_tmdb_api_key_here
```
**Lưu ý:** `TMDB_API_KEY` là tùy chọn. Nếu không có, hệ thống sẽ dùng placeholder images. Xem `HUONG_DAN_LAY_ANH.md` để lấy API key miễn phí.

### 4. Chạy MongoDB
Đảm bảo MongoDB đang chạy trên localhost:27017

## Sử dụng

### 1. Thu thập dữ liệu phim

**⚠️ KHUYẾN NGHỊ: Sử dụng script mới để lấy phim THẬT từ TMDb (100% có poster):**
```bash
npm run collect-tmdb
```
Xem `HUONG_DAN_LAY_PHIM_THAT.md` để biết cách lấy TMDb API key.

**Hoặc script cũ (tạo phim mẫu, nhiều phim không có poster):**
```bash
npm run collect-data
```

### 2. Xử lý dữ liệu
```bash
npm run process-data
```

### 3. Huấn luyện mô hình
```bash
npm run train-model
```

### 4. Chạy server
```bash
npm start
```

Truy cập: http://localhost:3000

## Tính năng

### Thu thập dữ liệu
- Web scraping từ website phim
- Tự động lấy ảnh poster từ TMDb API (tùy chọn)
- Lưu vào MongoDB với đầy đủ thông tin

### Xử lý dữ liệu
- Làm sạch missing values
- Chuẩn hóa dữ liệu
- Loại bỏ duplicate
- Vector hóa (TF-IDF)

### Trực quan hóa
- Phân bố rating
- Top movies
- Heatmap, bar chart, histogram

### Recommendation System
- Collaborative Filtering
- Content-Based Filtering
- Hybrid approach

### Đánh giá mô hình
- RMSE
- MAE
- Precision@K
- Recall@K

## Tác giả
[Thông tin tác giả]

## License
MIT

