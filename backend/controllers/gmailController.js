const { createLogger } = require('../utils/logger');
const gmailService = require('../services/gmailService');

const logger = createLogger('gmail-controller');

/**
 * Set Gmail tokens from Google authentication
 */
exports.setGmailTokens = async (req, res) => {
  try {
    const { googleToken, userInfo } = req.body;
    
    if (!googleToken || !userInfo) {
      return res.status(400).json({
        success: false,
        error: 'Google token and user info are required'
      });
    }
    
    // Verify the user ID from the token matches the authenticated user
    if (userInfo.sub !== req.user.uid) {
      return res.status(403).json({
        success: false,
        error: 'User ID mismatch'
      });
    }
    
    // Set the Gmail tokens
    await gmailService.setGmailTokens(googleToken, userInfo);
    
    res.json({
      success: true,
      message: 'Gmail tokens set successfully'
    });
  } catch (error) {
    logger.error(`Error setting Gmail tokens: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Refresh Gmail token using Firebase token
 */
exports.refreshGmailToken = async (req, res) => {
  try {
    const userId = req.user.uid;
    
    // Check if user authenticated with Google
    if (req.isGoogleAuth) {
      // We can use the Firebase token to authenticate Gmail
      await gmailService.refreshTokensFromFirebase(userId, req.user);
      
      return res.json({
        success: true,
        message: 'Gmail tokens refreshed successfully'
      });
    } else {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated with Google',
        message: 'Please sign in with Google to use Gmail features'
      });
    }
  } catch (error) {
    logger.error(`Error refreshing Gmail tokens: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get and analyze emails from Gmail
 */
exports.getEmails = async (req, res) => {
  try {
    const userId = req.user.uid;
    const maxResults = parseInt(req.query.maxResults) || 30;
    
    logger.info(`Getting emails for user ID: ${userId}, isGoogleAuth: ${req.isGoogleAuth}`);
    
    // If user authenticated with Google via Firebase, try to use that first
    let firebaseAuthSuccess = false;
    if (req.isGoogleAuth) {
      try {
        // Try to extract Gmail tokens from Firebase auth
        firebaseAuthSuccess = await gmailService.ensureTokensFromFirebase(userId, req.user);
        logger.info(`Firebase Google auth ${firebaseAuthSuccess ? 'successful' : 'failed'} for user: ${userId}`);
      } catch (firebaseAuthError) {
        logger.warn(`Failed to use Firebase Google auth: ${firebaseAuthError.message}`);
      }
    }
    
    // Check if we have Gmail tokens
    const hasTokens = gmailService.hasTokens(userId);
    if (!hasTokens) {
      logger.warn(`No Gmail tokens for user: ${userId}, isGoogleAuth: ${req.isGoogleAuth}`);
      return res.status(401).json({
        success: false,
        error: 'Gmail authorization required',
        message: 'Please authorize access to your Gmail account',
        isGoogleAuth: req.isGoogleAuth,
        needsGmailPermissions: req.isGoogleAuth,
        // Add a timeout to ensure client doesn't hang waiting for emails
        timeout: true
      });
    }
    
    // Set a timeout for the whole operation
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Gmail API request timeout')), 20000);
    });
    
    // Get emails from Gmail with timeout
    try {
      // Create a promise race between getting emails and timing out
      const emailsPromise = gmailService.getEmails(userId, maxResults);
      const emails = await Promise.race([emailsPromise, timeoutPromise]);
      
      // Get user email from Gmail API response if possible
      let userEmail = '';
      if (emails && emails.length > 0) {
        // Try to get from email property first
        const firstEmail = emails[0];
        if (firstEmail.userEmail) {
          userEmail = firstEmail.userEmail;
        }
      }
      
      return res.json({
        success: true,
        emails: emails,
        userEmail: userEmail,
        count: emails.length
      });
    } catch (error) {
      // Handle timeouts specifically
      if (error.message === 'Gmail API request timeout') {
        logger.warn(`Gmail request timed out for user: ${userId}`);
        return res.status(504).json({
          success: false,
          error: 'Request timed out',
          message: 'The Gmail API request timed out. Please try again.'
        });
      }
      
      // More specific error handling for auth issues
      if (error.message.includes('authentication') || 
          error.message.includes('authorized') || 
          error.message.includes('auth') ||
          error.message.includes('token')) {
        logger.warn(`Gmail auth error for ${userId}: ${error.message}`);
        return res.status(401).json({
          success: false,
          error: 'Gmail authorization required',
          message: 'Please authorize access to your Gmail account',
          isGoogleAuth: req.isGoogleAuth,
          needsGmailPermissions: req.isGoogleAuth
        });
      }
      
      throw error;
    }
  } catch (error) {
    logger.error(`Error getting emails: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to get emails',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Check if the user is authenticated for Gmail access
 */
exports.checkAuthStatus = async (req, res) => {
  try {
    const userId = req.user.uid;
    
    // Check if user is authenticated with Google via Firebase
    const isGoogleAuth = req.isGoogleAuth || false;
    
    // Check if the user has Gmail tokens stored
    const hasGmailTokens = await gmailService.hasTokens(userId);
    
    return res.json({
      success: true,
      user: {
        uid: userId,
        isGoogleAuth,
        hasGmailTokens
      }
    });
  } catch (error) {
    logger.error(`Error checking auth status: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
