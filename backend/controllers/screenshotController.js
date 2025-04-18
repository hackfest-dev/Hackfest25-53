const screenshotService = require('../services/screenshotService');
const { createLogger } = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');

const logger = createLogger('screenshot-controller');
const tmpDir = path.join(__dirname, '..', config.screenshot.tmpDir);

// Controller to take a screenshot
const takeScreenshot = async (req, res) => {
  try {
    const screenshot = screenshotService.takeScreenshot();
    
    // Return success response with file details
    return res.status(200).json({
      success: true,
      message: 'Screenshot captured successfully',
      filename: screenshot.filename,
      path: screenshot.path,
      size: screenshot.size
    });
  } catch (error) {
    logger.error('Error taking screenshot:', error);
    
    // Create a more user-friendly error message based on the specific error
    let errorMessage = 'Failed to take screenshot';
    let errorDetails = error.message;
    let statusCode = 500;
    let solution = null;
    
    if (error.message.includes('nircmd')) {
      errorMessage = 'Screenshot tool not available';
      errorDetails = 'The nircmd tool is not installed on this Windows system.';
      solution = 'You can install it by running "npm run setup-windows" from the project root or use the browser screenshot option.';
      statusCode = 400;
    } else if (error.message.includes('Snipping Tool') || error.message.includes('PowerShell screenshot failed')) {
      errorMessage = 'System screenshot failed';
      errorDetails = 'Could not capture screenshot using system utilities.';
      solution = 'Please try using the browser screenshot option instead.';
      statusCode = 400;
    }
    
    return res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: errorDetails,
      solution: solution,
      useBrowserFallback: true,
      platformHelp: getPlatformSpecificHelp()
    });
  }
};

// Controller to save a browser-based screenshot
const saveBrowserScreenshot = async (req, res) => {
  try {
    const { imageData } = req.body;
    
    if (!imageData) {
      return res.status(400).json({
        success: false,
        message: 'Screenshot data is required'
      });
    }
    
    // Extract base64 data from the data URL
    const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
    
    // Generate unique filename based on timestamp
    const timestamp = Date.now();
    const filename = `browser_screenshot_${timestamp}.png`;
    const outputPath = path.join(tmpDir, filename);
    
    // Save the image
    fs.writeFileSync(outputPath, Buffer.from(base64Data, 'base64'));
    
    // Get file stats
    const stats = fs.statSync(outputPath);
    const fileSizeInBytes = stats.size;
    const fileSizeInMB = fileSizeInBytes / (1024 * 1024);
    
    logger.info('Browser screenshot saved successfully!');
    logger.info(`File: ${filename}`);
    logger.info(`Path: ${outputPath}`);
    logger.info(`Size: ${fileSizeInMB.toFixed(2)} MB`);
    
    return res.status(200).json({
      success: true,
      message: 'Browser screenshot saved successfully',
      filename,
      path: outputPath,
      size: `${fileSizeInMB.toFixed(2)} MB`
    });
  } catch (error) {
    logger.error('Error saving browser screenshot:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save browser screenshot',
      error: error.message
    });
  }
};

// Helper function to provide platform-specific help
function getPlatformSpecificHelp() {
  if (process.platform === 'win32') {
    return 'On Windows, you can install nircmd by running "npm run setup-windows" or use PowerShell/Snipping Tool.';
  } else if (process.platform === 'darwin') {
    return 'On macOS, the screencapture utility should be available by default.';
  } else if (process.platform === 'linux') {
    return 'On Linux, please install gnome-screenshot, scrot, or ImageMagick.';
  } else {
    return 'Your platform is not directly supported for automatic screenshots.';
  }
}

// Controller to get a specific screenshot
const getScreenshot = async (req, res) => {
  try {
    const { filename } = req.params;
    const screenshot = screenshotService.getScreenshot(filename);
    
    res.contentType('image/png');
    return res.send(screenshot.buffer);
  } catch (error) {
    logger.error('Error retrieving screenshot:', error);
    return res.status(404).json({
      success: false,
      message: 'Screenshot not found',
      error: error.message
    });
  }
};

module.exports = {
  takeScreenshot,
  getScreenshot,
  saveBrowserScreenshot
};
