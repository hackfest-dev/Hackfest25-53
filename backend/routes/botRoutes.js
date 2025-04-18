const express = require('express');
const router = express.Router();
const botController = require('../controllers/botController');
const whatsappService = require('../services/whatsappService');

// Get QR code for WhatsApp login
router.get('/qr', botController.getQRCode);

// Get WhatsApp connection status
router.get('/status', async (req, res) => {
  try {
    // Check if we have a forceLogout parameter
    if (req.query.forceLogout === 'true') {
      try {
        await whatsappService.logout();
        return res.status(200).json({
          success: true,
          message: 'Force logout successful',
          status: { connected: false }
        });
      } catch (error) {
        console.error('Force logout error:', error);
      }
    }
    
    // Regular status code
    return await botController.getStatus(req, res);
  } catch (error) {
    console.error('Status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting status',
      error: error.message
    });
  }
});

// Send a message to a WhatsApp number
router.post('/send', botController.sendMessage);

// Logout and regenerate QR code - add extra logging
router.post('/logout', (req, res) => {
  console.log('Logout route accessed directly');
  return botController.logout(req, res);
});

// Add test route
router.get('/test', (req, res) => {
  return res.json({ success: true, message: 'Bot routes working' });
});

module.exports = router;
