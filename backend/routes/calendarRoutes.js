const express = require('express');
const router = express.Router();
const calendarManager = require('../services/calendarManager');
const authController = require('../controllers/authController');

// Get auth URL - now properly returns the URL
router.get('/auth/url', async (req, res) => {
  try {
    const userId = req.user?.uid || null;
    const authUrl = await calendarManager.authorize(userId);
    res.json({ success: true, authUrl });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Handle OAuth callback - FIXED to match the redirect URI
router.get('/oauth2callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).send('Error: No authorization code provided');
    }

    await calendarManager.setTokens(code);
    
    // Redirect to frontend with success message
    res.redirect(`/?authStatus=success&message=Successfully authenticated with Google Calendar`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`/?authStatus=error&message=${encodeURIComponent(error.message)}`);
  }
});

// Update OAuth callback to handle both direct browser callbacks and API requests
router.post('/oauth2callback', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ 
        success: false, 
        error: 'Authorization code is required' 
      });
    }

    await calendarManager.setTokens(code);
    res.json({ 
      success: true, 
      message: 'Successfully authenticated with Google Calendar' 
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get upcoming events with better error handling (protected by auth)
router.get('/events', authController.verifyToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const events = await calendarManager.getUpcomingEvents(userId);
    if (!events || events.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No upcoming events found',
        events: [] 
      });
    }
    res.json({ success: true, events });
  } catch (error) {
    if (error.message.includes('Not authorized')) {
      // Provide auth URL when not authorized
      const authUrl = await calendarManager.authorize(req.user.uid);
      return res.status(401).json({ 
        success: false, 
        error: 'Not authorized', 
        authUrl 
      });
    }
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Add event via natural language with improved authorization handling (protected by auth)
router.post('/events/natural', authController.verifyToken, async (req, res) => {
  try {
    const { text } = req.body;
    const userId = req.user.uid;
    
    if (!text) {
      return res.status(400).json({ 
        success: false, 
        error: 'Text input is required' 
      });
    }
    
    try {
      const event = await calendarManager.handleNaturalLanguageInput(text, userId);
      res.json({ 
        success: true, 
        event,
        calendarLink: event.htmlLink 
      });
    } catch (error) {
      // Special handling for authorization errors
      if (error.message.includes('Not authorized')) {
        console.log('Authorization required, generating auth URL');
        const authUrl = await calendarManager.authorize(userId);
        
        // Return 401 with auth URL for auto-opening in browser
        return res.status(401).json({ 
          success: false, 
          error: 'Calendar authorization required', 
          authUrl,
          autoOpen: true, // Signal that this URL should be auto-opened
          message: 'Please authorize access to your Google Calendar'
        });
      }
      
      // Re-throw other errors to be caught by the outer catch
      throw error;
    }
  } catch (error) {
    console.error('Error handling calendar event:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;