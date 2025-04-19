const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const authController = require('../controllers/authController');

// Route for daily tip - protected by auth
router.get('/daily-tip', authController.verifyToken, aiController.getDailyTip);

// Other AI-related routes can be added here

module.exports = router;
