const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not defined");
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB Connected:", conn.connection.host);
    try {
      const dbName = mongoose.connection.db.databaseName;
      console.log("👉 Đang kết nối vào Database tên là:", dbName);
  
      const collections = await mongoose.connection.db.listCollections().toArray();
      console.log("👉 Danh sách các Collection (bảng) có trong này:", collections.map(c => c.name));
      
      // Thử đếm xem có bao nhiêu phim
      // Thay 'movies' bằng tên collection bạn nghĩ là đúng, ví dụ 'phim' hoặc 'Movie'
      const count = await mongoose.connection.db.collection('movies').countDocuments(); 
      console.log("👉 Số lượng phim tìm thấy trong collection 'movies':", count);
  } catch (err) {
      console.log("Lỗi khi kiểm tra:", err);
  }
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
  }
};

module.exports = connectDB;
