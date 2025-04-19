const express = require('express');
const router = express.Router();
const botController = require('../controllers/botController');
const whatsappService = require('../services/whatsappService');
const { verifyToken } = require('../controllers/authController');

// Get QR code for WhatsApp login
router.get('/qr', botController.getQRCode);

// Get WhatsApp connection status - protected by auth middleware
router.get('/status', verifyToken, async (req, res) => {
  try {
    // Get the actual status from the WhatsApp service
    const status = whatsappService.getStatus();
    
    res.status(200).json({
      success: true,
      status: status,
      message: status.connected ? 'Bot is connected' : 'Bot is disconnected'
    });
  } catch (error) {
    console.error('Error checking bot status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check bot status',
      error: error.message
    });
  }
});

// Send a message to a WhatsApp number
router.post('/send', botController.sendMessage);

// Logout and regenerate QR code - should not be protected by auth to ensure it always works
router.post('/logout', (req, res) => {
  console.log('Logout route accessed directly');
  return botController.logout(req, res);
});

// Add test route
router.get('/test', (req, res) => {
  return res.json({ success: true, message: 'Bot routes working' });
});

module.exports = router;
