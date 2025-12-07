// Script khởi tạo dự án
const fs = require('fs');
const path = require('path');

const directories = [
  'data/raw',
  'data/processed',
  'data/visualizations',
  'models',
  'public/images/posters'
];

console.log('Đang tạo các thư mục cần thiết...');

directories.forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`✓ Đã tạo: ${dir}`);
  } else {
    console.log(`- Đã tồn tại: ${dir}`);
  }
});

console.log('\nHoàn thành! Bạn có thể chạy:');
console.log('1. npm run collect-data  - Thu thập dữ liệu');
console.log('2. npm run process-data  - Xử lý dữ liệu');
console.log('3. npm start            - Chạy server');

