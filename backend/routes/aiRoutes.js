const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const authController = require('../controllers/authController');
const { createLogger } = require('../utils/logger');

const logger = createLogger('ai-routes');

// Auth debug middleware
const authDebug = (req, res, next) => {
  logger.info(`Auth Debug - Headers: ${JSON.stringify(req.headers)}`);
  logger.info(`Auth Debug - Token present: ${!!req.headers.authorization}`);
  next();
};

// Route for daily tip - protected by auth with debugging
router.get('/daily-tip', authDebug, authController.verifyToken, aiController.getDailyTip);

// Speech-to-text route - initially without auth for easier testing
router.post('/transcribe', aiController.transcribeAudio);

// Debug endpoint to check authentication
router.get('/auth-check', authController.verifyToken, (req, res) => {
  logger.info('Auth check endpoint accessed');
  res.json({
    success: true, 
    message: 'Authentication successful',
    user: req.user
  });
});

// Other AI-related routes can be added here

module.exports = router;
