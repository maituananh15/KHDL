# BÁO CÁO DỰ ÁN: HỆ THỐNG GỢI Ý PHIM

## I. TỔNG QUAN DỰ ÁN

### 1.1. Mục tiêu dự án
Xây dựng một hệ thống gợi ý phim hoàn chỉnh với các tính năng:
- Thu thập và quản lý dữ liệu phim từ website
- Lưu trữ trong MongoDB với Mongoose
- Xác thực người dùng (đăng nhập/đăng ký)
- Theo dõi lịch sử click/xem phim
- Gợi ý phim cá nhân hóa dựa trên lịch sử người dùng

### 1.2. Công nghệ sử dụng
- **Backend:** Node.js, Express.js
- **Database:** MongoDB, Mongoose
- **Frontend:** HTML, CSS, JavaScript (Vanilla)
- **Machine Learning:** Python, scikit-learn, Surprise
- **Xử lý dữ liệu:** pandas, numpy
- **Trực quan hóa:** matplotlib, seaborn

## II. KIẾN TRÚC HỆ THỐNG

### 2.1. Cấu trúc dự án
```
├── Backend (Node.js/Express)
│   ├── Models: User, Movie, ClickHistory, Rating
│   ├── Routes: auth, movies, history, recommendations
│   └── Middleware: authentication
├── Frontend (Web Interface)
│   ├── Trang chủ, Đăng nhập/Đăng ký
│   ├── Danh sách phim với tìm kiếm và filter
│   ├── Trang gợi ý
│   └── Lịch sử xem
├── Data Processing (Python)
│   ├── Thu thập dữ liệu
│   ├── Làm sạch và chuẩn bị dữ liệu
│   ├── Trực quan hóa
│   └── Huấn luyện mô hình
└── Machine Learning
    ├── Recommendation Engine
    └── Evaluation Metrics
```

### 2.2. Luồng hoạt động
1. **Thu thập dữ liệu:** Script thu thập thông tin phim và lưu vào MongoDB
2. **Xử lý dữ liệu:** Làm sạch, chuẩn hóa, loại bỏ duplicate
3. **Trực quan hóa:** Tạo các biểu đồ phân tích dữ liệu
4. **Huấn luyện mô hình:** Xây dựng hệ gợi ý
5. **Web Interface:** Người dùng đăng nhập, xem phim, click → lưu lịch sử
6. **Gợi ý:** Dựa trên lịch sử click, hệ thống gợi ý phim phù hợp

## III. THU THẬP VÀ XỬ LÝ DỮ LIỆU

### 3.1. Thu thập dữ liệu
- **Nguồn dữ liệu:** Website phim (có thể tích hợp scraping thật)
- **Số lượng:** ≥ 2,000 movies
- **Features:** 
  - Title, Description
  - Genres (nhiều thể loại)
  - Year, Duration
  - Rating
  - Director, Cast
  - Country, Language
  - Poster, Trailer URL

### 3.2. Làm sạch và chuẩn bị dữ liệu

#### 3.2.1. Xử lý Missing Values
- Điền giá trị mặc định cho các trường bị thiếu
- Xử lý missing values trong: description, director, country, genres, etc.
- Sử dụng median cho các giá trị số (year, duration, rating)

#### 3.2.2. Loại bỏ Duplicate
- Loại bỏ duplicate dựa trên title + year
- Loại bỏ duplicate dựa trên sourceUrl

#### 3.2.3. Chuẩn hóa dữ liệu
- Chuẩn hóa text (trim, title case)
- Chuẩn hóa rating về thang 0-10
- Chuẩn hóa year và duration (clip trong khoảng hợp lệ)
- Chuẩn hóa genres (title case, loại bỏ empty)

#### 3.2.4. Xử lý Outliers
- Phát hiện outliers bằng IQR method
- Capping values cho rating và duration

#### 3.2.5. Vector hóa (TF-IDF)
- Tạo TF-IDF vectors từ title + description
- Lưu vectorizer và similarity matrix để sử dụng sau

## IV. TRỰC QUAN HÓA DỮ LIỆU

### 4.1. Các biểu đồ đã thực hiện
1. **Phân bố Rating:** Histogram và Box plot
2. **Top Movies:** Bar chart theo clickCount và rating
3. **Tần suất Thể loại:** Bar chart top 15 genres
4. **Phân bố Năm phát hành:** Histogram
5. **Heatmap:** Correlation matrix giữa các features
6. **Genre Rating:** Average rating theo thể loại

### 4.2. Thống kê tổng quan
- Tổng số phim
- Trung bình rating, duration
- Phân bố theo năm, thể loại
- Số lượt click/view

## V. HỆ THỐNG GỢI Ý

### 5.1. Phương pháp sử dụng

#### 5.1.1. Content-Based Filtering
- Dựa trên genres và tags của phim
- Tính điểm similarity dựa trên genre overlap
- Ưu tiên phim có genres giống với phim đã xem

#### 5.1.2. Collaborative Filtering
- Tìm users có sở thích tương tự
- Gợi ý phim mà những users tương tự đã xem
- Sử dụng MongoDB aggregation để tối ưu

#### 5.1.3. Hybrid Approach
- Kết hợp cả hai phương pháp
- Boost score nếu phim xuất hiện ở cả hai
- Scoring dựa trên: genre similarity, rating, popularity, recency

### 5.2. Đánh giá mô hình

#### 5.2.1. Metrics sử dụng
- **RMSE (Root Mean Squared Error):** Đo lỗi dự đoán rating
- **MAE (Mean Absolute Error):** Đo lỗi tuyệt đối trung bình
- **Precision@K:** Tỷ lệ phim được gợi ý thực sự phù hợp
- **Recall@K:** Tỷ lệ phim phù hợp được gợi ý

#### 5.2.2. Cross-validation
- Chia dữ liệu train/test (80/20)
- Cross-validation với k=3 folds
- Đánh giá trên test set

## VI. GIAO DIỆN WEB

### 6.1. Tính năng
- **Đăng ký/Đăng nhập:** JWT authentication
- **Danh sách phim:** Grid layout với pagination
- **Tìm kiếm và Filter:** Theo genre, year, keyword
- **Chi tiết phim:** Modal hiển thị đầy đủ thông tin
- **Gợi ý:** Trang gợi ý cá nhân hóa
- **Lịch sử:** Xem lại các phim đã click

### 6.2. Click History Tracking
- Tự động lưu mỗi khi user click vào phim
- Lưu: userId, movieId, timestamp, action type
- Sử dụng để xây dựng user profile
- Cập nhật clickCount của phim

## VII. KẾT QUẢ

### 7.1. Dữ liệu
- ✓ ≥ 2,000 movies trong database
- ✓ ≥ 5 features mô tả mỗi movie
- ✓ Dữ liệu đã được làm sạch và chuẩn hóa

### 7.2. Xử lý dữ liệu
- ✓ Xử lý missing values
- ✓ Chuẩn hóa dữ liệu
- ✓ Loại bỏ duplicate
- ✓ Xử lý outliers
- ✓ Vector hóa (TF-IDF)

### 7.3. Trực quan hóa
- ✓ Phân bố rating
- ✓ Top movies
- ✓ Tần suất genres
- ✓ Heatmap
- ✓ Histogram, Bar chart

### 7.4. Mô hình
- ✓ Content-Based Filtering
- ✓ Collaborative Filtering
- ✓ Hybrid approach
- ✓ Đánh giá: RMSE, MAE, Precision@K, Recall@K

### 7.5. Giao diện
- ✓ Web interface hoàn chỉnh
- ✓ Authentication system
- ✓ Click history tracking
- ✓ Recommendation display

## VIII. HƯỚNG PHÁT TRIỂN

### 8.1. Nâng cấp ngắn hạn
- Thu thập dữ liệu thật từ website phim
- Cải thiện UI/UX
- Thêm tính năng rating/review
- Real-time recommendations

### 8.2. Nâng cấp dài hạn
- Sử dụng Deep Learning (Neural Collaborative Filtering)
- Context-aware recommendations (thời gian, thiết bị)
- Multi-modal features (poster image embeddings)
- Deploy lên cloud (AWS, GCP, Azure)
- Mobile app

## IX. KẾT LUẬN

Dự án đã hoàn thành đầy đủ các yêu cầu:
- Thu thập và quản lý dữ liệu phim
- Xử lý và trực quan hóa dữ liệu
- Xây dựng hệ gợi ý với nhiều phương pháp
- Giao diện web với authentication
- Tracking lịch sử click và gợi ý cá nhân hóa

Hệ thống có thể mở rộng và cải thiện thêm với các tính năng nâng cao.

---

**Tác giả:** [Tên sinh viên]
**Mã sinh viên:** [Mã SV]
**Ngày:** [Ngày nộp]

