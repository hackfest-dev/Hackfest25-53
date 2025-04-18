const whatsappService = require('../services/whatsappService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('bot-controller');

// Get WhatsApp QR code
const getQRCode = async (req, res) => {
  try {
    logger.info('QR code requested from API');
    const qrCode = whatsappService.getQRCode();
    
    if (!qrCode) {
      logger.info('No QR code available, returning 202');
      return res.status(202).json({
        success: true,
        message: 'QR code not yet available or already logged in',
        qrCode: null
      });
    }
    
    logger.info('Returning QR code to client');
    return res.status(200).json({
      success: true,
      message: 'QR code retrieved successfully',
      qrCode
    });
  } catch (error) {
    logger.error('Error retrieving QR code:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve QR code',
      error: error.message
    });
  }
};

// Get WhatsApp connection status
const getStatus = async (req, res) => {
  try {
    const status = whatsappService.getStatus();
    
    return res.status(200).json({
      success: true,
      message: 'Status retrieved successfully',
      status
    });
  } catch (error) {
    logger.error('Error retrieving status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve status',
      error: error.message
    });
  }
};

// Send a message to a WhatsApp number
const sendMessage = async (req, res) => {
  try {
    const { number, message } = req.body;
    
    if (!number || !message) {
      return res.status(400).json({
        success: false,
        message: 'Number and message are required'
      });
    }
    
    const result = await whatsappService.sendMessage(number, message);
    
    return res.status(200).json({
      success: true,
      message: 'Message sent successfully',
      recipient: result.recipient,
      messageId: result.messageId
    });
  } catch (error) {
    logger.error('Error sending message:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
};

// Logout and regenerate QR code
const logout = async (req, res) => {
  try {
    logger.info('Logout requested');
    const result = await whatsappService.logout();
    
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Logged out successfully, QR code will be regenerated'
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Failed to logout',
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Error during logout:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to logout',
      error: error.message
    });
  }
};

module.exports = {
  getQRCode,
  getStatus,
  sendMessage,
  logout
};
