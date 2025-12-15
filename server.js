const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const connectDB = require('./config/database');
require('dotenv').config();
connectDB();

// Import routes
const authRoutes = require('./routes/auth');
const movieRoutes = require('./routes/movies');
const historyRoutes = require('./routes/history');
const recommendationRoutes = require('./routes/recommendations');
const statsRoutes = require('./routes/stats');

// Connect to database


const app = express();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || '*'
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/stats', statsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

