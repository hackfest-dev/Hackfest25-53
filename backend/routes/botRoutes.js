const express = require('express');
const router = express.Router();
const botController = require('../controllers/botController');

// Route to get QR code
router.get('/qr', botController.getQRCode);

// Route to get connection status
router.get('/status', botController.getStatus);

// Route to send a message
router.post('/send', botController.sendMessage);

module.exports = router;
