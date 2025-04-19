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
    const maxResults = parseInt(req.query.maxResults) || 100;
    
    // If user authenticated with Google via Firebase, try to use that first
    if (req.isGoogleAuth) {
      try {
        // This will use the existing Firebase Google auth
        await gmailService.ensureTokensFromFirebase(userId, req.user);
      } catch (firebaseAuthError) {
        logger.warn(`Failed to use Firebase Google auth: ${firebaseAuthError.message}`);
        // Continue to try normal Gmail auth
      }
    }
    
    // Get emails from Gmail
    try {
      const emails = await gmailService.getEmails(userId, maxResults);
      
      // Analyze emails for priority
      const analyzedEmails = await gmailService.analyzeEmailPriority(emails);
      
      return res.json({
        success: true,
        emails: analyzedEmails
      });
    } catch (error) {
      if (error.message.includes('Not authorized')) {
        // Return 401 with instructions to authorize
        return res.status(401).json({
          success: false,
          error: 'Gmail authorization required',
          message: 'Please authorize access to your Gmail account'
        });
      }
      
      // Re-throw other errors
      throw error;
    }
  } catch (error) {
    logger.error(`Error getting emails: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to get emails',
      message: error.message
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
