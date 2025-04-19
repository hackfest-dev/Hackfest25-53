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
    const { code, state } = req.query;
    
    if (!code) {
      return res.status(400).send('Error: No authorization code provided');
    }

    // Get tokens from the authorization code
    const tokens = await gmailService.getTokensFromCode(code);
    
    // If state contains user ID, use it to store tokens
    const userId = state || null;
    if (userId) {
      // Extract user info from ID token if available
      let userInfo = null;
      if (tokens.id_token) {
        try {
          // Decode the ID token to get user info
          const jwt = require('jsonwebtoken');
          const decoded = jwt.decode(tokens.id_token);
          userInfo = {
            sub: decoded.sub,
            email: decoded.email
          };
        } catch (decodeError) {
          console.error('Error decoding ID token:', decodeError);
        }
      }
      
      // If we have user info, save tokens
      if (userInfo) {
        await gmailService.setGmailTokens(tokens, userInfo);
      }
    } else {
      // If no user ID in state, just save tokens without user association
      await gmailService.setTokens(code);
    }
    
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
