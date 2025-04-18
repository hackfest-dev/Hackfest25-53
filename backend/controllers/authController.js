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
      projectId: process.env.FIREBASE_PROJECT_ID || "filenest12390",
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDELoebOYgnJA0q\ndlcxZX41z2tjoqI88bul6pysgXMIWSCCsGLW7DRKo3vkk157mLzJfhH/q7HSmKFZ\nM+qHspAdJozESPfNL6zFq7nmEWgVfq9n5t8+3fMIx3suGnQK2JGtEWLT0zb/TbW4\n0ZNxIttQxdLjIP5uYQLy4HRGh1aZrQdK7QRSdjpFruEIARSYQKzQxI0FoH4qsG9q\noJLRlY0J7HPmNAfMsXceDMGzWuYsZfG0GaD8wCDGVQ8+n4bYPw5cEty34YllXOcD\nio7QenghIkRAUULY/x6pQ1V8RrX1dJa9KQA2CY+taRXRovV2zo3Dd6l69dTUhXJe\n4BMOXdenAgMBAAECggEAH8PW8jPND2Vfel4h/R4NYwIcRcw6D7smYpWL28S0Dwh7\nYp3TyzAAwYsaDucrt8CB5PA0Ut0GlG5hRbPJyEIJ4qZwyYF1GjSbeYA2QAHWhBB4\nr06rHB9M8EF4eP0QiAcMA2Vaxqie8ZSwFWZdxMZbk4cMf/lCKTYtB41/VkIorAYW\nxvN9I4aSgpOLvXc2GKF3i+FwCE2nopLGGJKmXjsoFOwsV1hAXZ5sXEX8AoQBALHC\nnnqFO6pHr0Zil0BqhhsJms+r5dDLUSCYlu5BH3+3r22ryECSX6ZtX3KVfEtQRo6G\nj9sDxC3hB/AyO/CrO+a3bJ83l4n2SqG77eQUB8LyvQKBgQD3i7SNilBK0IAlNnNt\nRcg3uSoiXMLXujrpLguBEda6kdg5po9aWwvSZy06qCZFGWLPS2v7baT0XSszmSAE\nRiADbPBi89W87b/AtE9TOmfxC2BkIpOYRUYRVznfBgO4Z0tc6rE4eHiUw/xEo6Xr\nq563CcL64S8sUtTz4YNV0my6FQKBgQDK4b+uYIPgWiAR+tsqPTDjEZKHqfJpN5lk\n0MNFCogWaiD1hEaogGFb1zpsPbwNm1jXl5wUKqZ5OQVWGbsm4lKUiIyq9/U9JNTx\n7AKM4W4QjnT/Lb03i3cFoK9MS3gci/Va0M0qu1flViyOfthN2RV8lkydW3wLXh3p\nGBMA9MxlywKBgC5GPGM1FttVbI8IRb2IjOv1vi2cP4QKORb714SyK/zGZLAqNaQD\nXwte5DKR2k2SeEkd5Tqj/XD8taW4myaRYUyiobEtuafOncjNLAL36RRDNyqg2Axf\n7sAxGQ1a13kyPgFJkgVnZ8sPc+n02YBbnZjDx2IUlDfp6AsK/f0eD9sdAoGAX6za\nMie9yT13RkNgu6ijt1GAIo4YjVn08sAodhSjXL6r0FyS3b+9KgxztrveRSRvXyxW\nJISAgUZMp+/2fD3a58UFYVMRycXmzjeYdEuTFie4MOanBty0QmkmgfpNKFkwWaWC\nO5ahurtKw+A5rWykX16ZvtN3yfyWamg5/gdzpMUCgYEA0DUqTn5zVhVL4AntDn7y\ne4a918ffgC4WIWAc7CKF0Q+SYQEhXhkauNkOmtB0V/8JuNlyhjlFocjrU8yOx7c0\nChFUBLCqrjpx7nt6GCEm0qC4U7BLDzD4/3tIP8s1OlfBUaXcwQXTc8qTkmi0k6RY\nf3/FstCnMYhgLXN7jioWv6M=\n-----END PRIVATE KEY-----\n").replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk-tr1ls@filenest12390.iam.gserviceaccount.com"
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