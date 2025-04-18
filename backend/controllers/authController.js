const { createLogger } = require('../utils/logger');
const admin = require('firebase-admin');
const { OAuth2Client } = require('google-auth-library');
const calendarManager = require('../services/calendarManager');

const logger = createLogger('auth-controller');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      // Replace these with your Firebase admin service account credentials
      projectId: process.env.FIREBASE_PROJECT_ID || "your-project-id",
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "your-service-account-email"
    })
  });
}

// Google OAuth2 client for token verification
const googleClient = new OAuth2Client();

// Middleware to verify Firebase token
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized - No token provided'
    });
  }
  
  const token = authHeader.split('Bearer ')[1];
  
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    logger.error('Token verification failed:', error);
    return res.status(401).json({
      success: false,
      message: 'Unauthorized - Invalid token',
      error: error.message
    });
  }
};

// Handle Google authentication and calendar setup
const handleGoogleAuth = async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required'
      });
    }
    
    // Verify the token
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID // Replace with your Google Client ID
    });
    
    const payload = ticket.getPayload();
    
    // Get tokens from payload
    const googleToken = {
      access_token: token,
      id_token: token
    };
    
    // Set up Calendar credentials
    try {
      await calendarManager.setGoogleTokens(googleToken, payload);
      
      return res.status(200).json({
        success: true,
        message: 'Google authentication successful',
        user: {
          uid: payload.sub,
          email: payload.email,
          name: payload.name
        }
      });
    } catch (calendarError) {
      logger.error('Calendar setup error:', calendarError);
      return res.status(500).json({
        success: false,
        message: 'Authentication successful but calendar setup failed',
        error: calendarError.message
      });
    }
  } catch (error) {
    logger.error('Google auth error:', error);
    return res.status(401).json({
      success: false,
      message: 'Authentication failed',
      error: error.message
    });
  }
};

module.exports = {
  verifyToken,
  handleGoogleAuth
};
