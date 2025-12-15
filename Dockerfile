# Sử dụng image chính chủ của Puppeteer (đã có sẵn Chrome và các thư viện cần thiết)
FROM ghcr.io/puppeteer/puppeteer:22.6.5

# Thiết lập thư mục làm việc
WORKDIR /app

# Chuyển sang quyền root để cài đặt dependencies
USER root

# Copy file package để tận dụng Docker cache
COPY package*.json ./

# Cấu hình biến môi trường để không tải lại Chrome (vì image gốc đã có rồi)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Cài đặt các thư viện node
RUN npm ci

# Copy toàn bộ code của bạn vào
COPY . .

# Chuyển lại về user bảo mật của puppeteer
USER pptruser

# Lệnh chạy server
CMD ["npm", "start"]