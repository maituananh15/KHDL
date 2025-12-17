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
│   ├── Models: user, movie, history, userRating
│   ├── Routes: auth, movies, history, recommendations, ratings, stats, evaluation
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
- **Content-based theo mô tả + thể loại:** sử dụng token hóa description (Jaccard similarity) và genres, cộng thêm điểm theo rating, views, độ mới năm phát hành.
- **Gợi ý theo phim vừa xem:** lấy bộ phim user vừa xem gần nhất trong `history`, tìm phim tương tự về nội dung/thể loại, sắp xếp theo score.
- **Fallback:** top phim phổ biến (rating/views) khi user chưa có lịch sử xem.

### 6.2. API
- `/api/recommendations` (cá nhân hóa, yêu cầu đăng nhập).
- `/api/recommendations/similar/:movieId` (gợi ý theo nội dung).

## VII. ĐÁNH GIÁ MÔ HÌNH
### 7.1. Chỉ số
- **RMSE:** căn bậc hai trung bình bình phương sai khác rating dự đoán vs. thực; càng thấp càng tốt.
- **MAE:** sai số tuyệt đối trung bình; càng thấp càng tốt.
- **Precision@K:** trong K gợi ý đầu, tỷ lệ phim đúng sở thích; càng cao càng tốt.
- **Recall@K:** trong các phim đúng sở thích, bao nhiêu xuất hiện trong K gợi ý; càng cao càng tốt.

### 7.2. Quy trình đánh giá (thực tế đã triển khai)
- **Nguồn dữ liệu đánh giá:** bảng `user_ratings` (rating người dùng nhập từ giao diện web, 0.5–5 sao/phim).
- **Bước 1 – Sinh dữ liệu đánh giá:** script `scripts/exportEvalDataFromUserRatings.js`:
  - Gom các user có ít nhất 1 rating.
  - Với mỗi user, gọi `Recommendation.getRecommendations(userId, K)` để lấy danh sách gợi ý top‑K.
  - Xây `all_recommendations[user]` (phim được gợi ý) và `all_relevant_items[user]` (các phim user đã rating ≥ 3 sao).
  - Lưu thêm `user_item_ratings[user][movie] = rating` vào file `ml/eval_data_user_ratings.json`.
- **Bước 2 – Tính chỉ số offline (Python):** file `ml/run_offline_evaluation.py`:
  - Đọc `eval_data_user_ratings.json`.
  - **Precision@K, Recall@K:** tính trung bình trên toàn bộ user giữa danh sách gợi ý và danh sách phim relevant (rating ≥ 3).
  - **RMSE, MAE (xấp xỉ):** xây:
    - \(y_{\text{true}}\): rating thật của user cho từng (user, movie).
    - \(y_{\text{pred}}\): điểm dự đoán đơn giản: 5 nếu phim nằm trong danh sách gợi ý top‑K của user, 2 nếu không.
    - Tính RMSE, MAE giữa hai vector này để đo “mức độ phù hợp” của gợi ý so với rating thật.
- **Bước 3 – Hiển thị:** script ghi kết quả vào `evaluation_result.json`; backend đọc qua API `/api/evaluation` và frontend hiển thị ở trang “Đánh giá mô hình”.

### 7.3. Kết quả thực tế (offline)
- **Cấu hình đánh giá hiện tại:**
  - \(K = 10\).
  - Ngưỡng phim relevant: rating người dùng **≥ 3**.
  - Dữ liệu từ bảng `user_ratings` ngày 17/12/2025.
- **Kết quả đo được (trích từ `evaluation_result.json`):**
  - **RMSE ≈ 2.36**
  - **MAE ≈ 2.13**
  - **Precision@10 ≈ 0.05**
  - **Recall@10 ≈ 0.058**
  - Thời điểm tính: `2025-12-17T14:32:40Z`
- **Nhận xét nhanh:**
  - Precision/Recall còn **thấp** do hệ thống chủ yếu dựa trên content-based đơn giản và số lượng rating của người dùng còn ít.
  - RMSE/MAE ở mức khá cao vì cách xấp xỉ \(y_{\text{pred}}\) rất thô (chỉ dựa vào việc phim có được gợi ý hay không). Khi có model dự đoán rating số riêng, có thể cải thiện ý nghĩa của hai chỉ số này.

## VIII. GIAO DIỆN WEB
- Trang: Home, Danh sách phim (tìm kiếm/lọc), Gợi ý, Lịch sử, Dashboard thống kê, Đánh giá mô hình.
- **Auth:** Đăng nhập/đăng ký (JWT); chỉ hiện nút Đăng nhập, link Đăng ký trong form.
- **History:** ghi nhận xem phim, dùng cho collaborative.
- **Evaluation page:** hiển thị RMSE/MAE/Precision@K/Recall@K kèm mô tả tiêu chí.

## IX. KẾT QUẢ ĐẠT ĐƯỢC (tóm tắt theo yêu cầu học phần)
- Dữ liệu: mục tiêu ≥ 2.000 phim, ≥ 5 thuộc tính (đáp ứng về schema; cần xác nhận số thực tế).
- Làm sạch/chuẩn bị: đã thiết kế quy trình đáp ứng ≥3 tác vụ (missing, chuẩn hóa, duplicate, outlier, vector hóa); cần log thực thi.
- Trực quan hóa: ≥3 biểu đồ (rating histogram, genre frequency bar, top items; có thể bổ sung heatmap).
- Mô hình gợi ý: Content-based theo mô tả + thể loại, gợi ý theo phim vừa xem, fallback phim phổ biến; API hoạt động.
- Đánh giá: đã có pipeline offline dùng bảng `user_ratings`, script Python, API `/api/evaluation` và trang hiển thị; đã có số liệu RMSE/MAE/Precision@K/Recall@K thực tế.

## X. HƯỚNG PHÁT TRIỂN
- Bổ sung kết quả đánh giá thực chạy offline; tự động cập nhật vào `/api/evaluation`.
- Thêm embedding (Word2Vec/BERT) cho nội dung, ALS/LightFM cho collaborative.
- Thêm heatmap tương quan, A/B testing, logging feedback.
- Mở rộng UI/UX, đa ngôn ngữ, mobile app.

## XI. KẾT LUẬN
Hệ thống đã hoàn thiện kiến trúc, API, giao diện và mô hình gợi ý content-based, cùng pipeline đánh giá offline dựa trên rating thật của người dùng (bảng `user_ratings`). Cần bổ sung minh chứng dữ liệu (số lượng thực), log làm sạch chi tiết, và có thể cải thiện thêm mô hình (collaborative/hybrid, dự đoán rating số) để nâng cao chất lượng gợi ý và ý nghĩa các chỉ số RMSE/MAE. Nền tảng sẵn sàng mở rộng với mô hình nâng cao và thêm tính năng người dùng.

---
**Tác giả:** …  
**Mã sinh viên:** …  
**Ngày:** …

