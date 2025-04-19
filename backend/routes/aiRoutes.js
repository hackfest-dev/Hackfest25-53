const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const authController = require('../controllers/authController');

// Route for daily tip - protected by auth
router.get('/daily-tip', authController.verifyToken, aiController.getDailyTip);

// Speech-to-text route - initially without auth for easier testing
router.post('/transcribe', aiController.transcribeAudio);

// Other AI-related routes can be added here

module.exports = router;
