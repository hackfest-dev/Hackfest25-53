const express = require('express');
const router = express.Router();
const gmailController = require('../controllers/gmailController');
const authController = require('../controllers/authController');
const gmailService = require('../services/gmailService');

// Get auth URL
router.get('/auth/url', authController.verifyToken, async (req, res) => {
  try {
    const userId = req.user?.uid || null;
    const authUrl = await gmailService.authorize(userId);
    res.json({ success: true, authUrl });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Handle OAuth callback
router.get('/oauth2callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).send('Error: No authorization code provided');
    }

    await gmailService.setTokens(code);
    
    // Redirect to frontend with success message
    res.redirect(`/?authStatus=success&message=Successfully authenticated with Gmail`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`/?authStatus=error&message=${encodeURIComponent(error.message)}`);
  }
});

// Set Gmail tokens from Google auth
router.post('/set-gmail-token', authController.verifyToken, gmailController.setGmailTokens);

// Refresh Gmail token using Firebase token
router.post('/refresh-token', authController.verifyToken, gmailController.refreshGmailToken);

// Get emails from Gmail
router.get('/emails', authController.verifyToken, gmailController.getEmails);

// Check if the user is authenticated with Google for Gmail
router.get('/auth-status', authController.verifyToken, gmailController.checkAuthStatus);

module.exports = router;
