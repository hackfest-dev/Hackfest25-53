const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Handle Google authentication
router.post('/google', authController.handleGoogleAuth);

// Test auth route
router.get('/verify', authController.verifyToken, (req, res) => {
  res.json({
    success: true,
    message: 'Token verified successfully',
    user: req.user
  });
});

module.exports = router;
