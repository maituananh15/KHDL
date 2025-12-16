# BÁO CÁO DỰ ÁN: HỆ THỐNG GỢI Ý PHIM

## I. TỔNG QUAN DỰ ÁN

### 1.1. Mục tiêu
Xây dựng hệ thống gợi ý phim cá nhân hóa đáp ứng các tiêu chí học phần: dữ liệu ≥ 2.000 phim, ≥ 5 thuộc tính, làm sạch (≥3 tác vụ), phân tích & trực quan (≥3 tác vụ), mô hình gợi ý và đánh giá bằng RMSE, MAE, Precision@K, Recall@K.

### 1.2. Công nghệ
- **Backend:** Node.js, Express.
- **Database:** MongoDB, Mongoose.
- **Frontend:** HTML/CSS/JS thuần, Chart.js cho dashboard.
- **ML/Data:** Python, pandas, numpy, scikit-learn; TF‑IDF/vector hóa nội dung.
- **Triển khai:** Railway; CORS cấu hình qua biến môi trường.

## II. KIẾN TRÚC HỆ THỐNG
```
├── Backend (Express)
│   ├── Models: user, movie, history
│   ├── Routes: auth, movies, history, recommendations, stats, evaluation
│   └── Middleware: auth (JWT)
├── Frontend (public/)
│   ├── Trang: home, movies, recommendations, history, dashboard, evaluation
│   └── Dashboard/Evaluation: biểu đồ, thẻ chỉ số
├── Data/ML (Python)
│   ├── Thu thập: collectMoviesFromTMDB.js
│   ├── Xử lý: processData.py, trainModel.py
│   └── Đánh giá: evaluation.py
└── Triển khai: Procfile, config/database.js
```
**Luồng:** Thu thập → Làm sạch/chuẩn hóa → Phân tích/biểu đồ → Huấn luyện/đề xuất → Đánh giá → Triển khai web.

## III. THU THẬP DỮ LIỆU
- **Nguồn:** TMDB qua script `scripts/collectMoviesFromTMDB.js`.
- **Quy mô:** mục tiêu ≥ 2.000 phim (ghi lại số thực tế sau khi chạy).
- **Thuộc tính chính (≥5):** title, description, genres, year, duration, rating, director, cast, country, language, poster, tags, tmdbId, views/clickCount.
- **Lưu trữ:** MongoDB, collection `movies` (schema `models/movie.js`).

## IV. LÀM SẠCH & CHUẨN BỊ DỮ LIỆU
Thực hiện tối thiểu 3 tác vụ (khuyến nghị):
1) **Missing values:** điền mặc định cho poster/language/country; loại bản ghi thiếu title/description/sourceUrl.
2) **Chuẩn hóa:** genres/tags chữ thường; rating trong [0,10]; year trong [1900, now+1]; duration cắt ngưỡng hợp lý.
3) **Loại bỏ duplicate:** theo tmdbId (unique) và cặp (title, year).
4) **Outlier:** capping duration, rating; kiểm tra year bất thường.
5) **Vector hóa nội dung:** TF‑IDF title/description/tags dùng cho content-based.
(Ghi lại log hoặc notebook đã chạy để minh chứng.)

## V. PHÂN TÍCH & TRỰC QUAN HÓA
API `routes/stats.js`, hiển thị ở Dashboard:
- **Phân bố rating:** Histogram (0–10, bước 0.5).
- **Tần suất thể loại:** Bar chart top 15 genres.
- **Top items:** Sắp xếp rating/views, trả top N.
- (Tùy chọn) Heatmap tương quan hoặc year‑rating nếu bổ sung sau.

## VI. HỆ THỐNG GỢI Ý
### 6.1. Phương pháp
- **Content-based:** genres/tags, TF‑IDF/overlap, ưu tiên phim chưa xem, có rating/views cao.
- **Collaborative:** người dùng tương tự dựa trên lịch sử xem (`history`), gợi ý phim phổ biến trong nhóm tương tự.
- **Hybrid:** gộp hai nguồn, cộng điểm, ưu tiên xuất hiện ở cả hai; thêm yếu tố rating, popularity, recency.
- **Fallback:** top phim (rating/views) khi chưa có lịch sử.

### 6.2. API
- `/api/recommendations` (cá nhân hóa, yêu cầu đăng nhập).
- `/api/recommendations/similar/:movieId` (gợi ý theo nội dung).

## VII. ĐÁNH GIÁ MÔ HÌNH
### 7.1. Chỉ số
- **RMSE:** căn bậc hai trung bình bình phương sai khác rating dự đoán vs. thực; càng thấp càng tốt.
- **MAE:** sai số tuyệt đối trung bình; càng thấp càng tốt.
- **Precision@K:** trong K gợi ý đầu, tỷ lệ phim đúng sở thích; càng cao càng tốt.
- **Recall@K:** trong các phim đúng sở thích, bao nhiêu xuất hiện trong K gợi ý; càng cao càng tốt.

### 7.2. Quy trình đánh giá (đề xuất)
- Chia train/test (hoặc leave-one-out) trên lịch sử xem/rating.
- Dự đoán rating (cho RMSE/MAE) và sinh top‑K (cho Precision/Recall).
- Tính trung bình trên tập người dùng test; K mặc định 10.

### 7.3. Kết quả (cần cập nhật số liệu thực tế)
- Ví dụ placeholder (đang trả qua `/api/evaluation`): RMSE 0.89, MAE 0.71, Precision@10 0.42, Recall@10 0.31, cập nhật lúc …
- Khi có số thật từ script đánh giá (Python), cập nhật vào API `routes/evaluation.js` và ghi lại tại đây.

## VIII. GIAO DIỆN WEB
- Trang: Home, Danh sách phim (tìm kiếm/lọc), Gợi ý, Lịch sử, Dashboard thống kê, Đánh giá mô hình.
- **Auth:** Đăng nhập/đăng ký (JWT); chỉ hiện nút Đăng nhập, link Đăng ký trong form.
- **History:** ghi nhận xem phim, dùng cho collaborative.
- **Evaluation page:** hiển thị RMSE/MAE/Precision@K/Recall@K kèm mô tả tiêu chí.

## IX. KẾT QUẢ ĐẠT ĐƯỢC (tóm tắt theo yêu cầu học phần)
- Dữ liệu: mục tiêu ≥ 2.000 phim, ≥ 5 thuộc tính (đáp ứng về schema; cần xác nhận số thực tế).
- Làm sạch/chuẩn bị: đã thiết kế quy trình đáp ứng ≥3 tác vụ (missing, chuẩn hóa, duplicate, outlier, vector hóa); cần log thực thi.
- Trực quan hóa: ≥3 biểu đồ (rating histogram, genre frequency bar, top items; có thể bổ sung heatmap).
- Mô hình gợi ý: Content-based, Collaborative, Hybrid; API hoạt động.
- Đánh giá: có endpoint và trang hiển thị; cần cập nhật số liệu đo thực tế.

## X. HƯỚNG PHÁT TRIỂN
- Bổ sung kết quả đánh giá thực chạy offline; tự động cập nhật vào `/api/evaluation`.
- Thêm embedding (Word2Vec/BERT) cho nội dung, ALS/LightFM cho collaborative.
- Thêm heatmap tương quan, A/B testing, logging feedback.
- Mở rộng UI/UX, đa ngôn ngữ, mobile app.

## XI. KẾT LUẬN
Hệ thống đã hoàn thiện kiến trúc, API, giao diện và mô hình gợi ý lai. Cần bổ sung minh chứng dữ liệu (số lượng thực), log làm sạch, và số liệu đánh giá thật để đáp ứng đầy đủ yêu cầu học phần. Nền tảng sẵn sàng mở rộng với mô hình nâng cao và thêm tính năng người dùng.

---
**Tác giả:** …  
**Mã sinh viên:** …  
**Ngày:** …

