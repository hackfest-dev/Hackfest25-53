const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

// Import route files
const authRoutes = require('./routes/authRoutes');
const botRoutes = require('./routes/botRoutes');
const calendarRoutes = require('./routes/calendarRoutes');
const aiRoutes = require('./routes/aiRoutes'); // Import AI routes

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/bot', botRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/ai', aiRoutes); // Register AI routes

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

module.exports = app;