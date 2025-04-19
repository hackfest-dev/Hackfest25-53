const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

// Import route files
const authRoutes = require('./routes/authRoutes');
const botRoutes = require('./routes/botRoutes');
const calendarRoutes = require('./routes/calendarRoutes');
const aiRoutes = require('./routes/aiRoutes'); // Import AI routes
const commandRoutes = require('./routes/commandRoutes');
const screenshotRoutes = require('./routes/screenshotRoutes');

// Create the express app
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // Increase limit for audio files
app.use(bodyParser.urlencoded({ extended: true }));

// Simple test route at root level
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working' });
});

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/bot', botRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/command', commandRoutes);
app.use('/api/screenshot', screenshotRoutes);
app.use('/api/ai', aiRoutes); // Register AI routes

// Test route specifically for AI routes
app.get('/api/ai-test', (req, res) => {
  res.json({ message: 'AI routes test endpoint' });
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

module.exports = app;