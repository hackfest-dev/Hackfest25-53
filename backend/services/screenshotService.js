const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { createLogger } = require('../utils/logger');
const config = require('../config/config');

const logger = createLogger('screenshot-service');
const tmpDir = path.join(__dirname, '..', config.screenshot.tmpDir);

// Ensure tmp directory exists
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

// Function to take a screenshot based on platform
function takeScreenshot() {
  try {
    // Generate unique filename based on timestamp
    const timestamp = Date.now();
    const filename = `screenshot_${timestamp}.png`;
    const outputPath = path.join(tmpDir, filename);
    
    logger.info(`Taking screenshot and saving to: ${outputPath}`);
    
    // Take screenshot using different commands based on OS
    if (process.platform === 'darwin') {
      // macOS
      execSync(`screencapture -x "${outputPath}"`);
    } else if (process.platform === 'win32') {
      try {
        // Try nircmd first (if installed)
        execSync(`nircmd savescreenshot "${outputPath}"`);
      } catch (error) {
        logger.info('nircmd not found, using PowerShell fallback...');
        // Fallback to PowerShell with improved error handling
        try {
          const psScript = `
            [void][System.Reflection.Assembly]::LoadWithPartialName("System.Drawing")
            [void][System.Reflection.Assembly]::LoadWithPartialName("System.Windows.Forms")
            $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
            $bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
            $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
            $graphics.CopyFromScreen($bounds.X, $bounds.Y, 0, 0, $bounds.Size)
            $bitmap.Save("${outputPath.replace(/\\/g, '\\\\')}", [System.Drawing.Imaging.ImageFormat]::Png)
            $graphics.Dispose()
            $bitmap.Dispose()
            Write-Output "Screenshot saved to: ${outputPath.replace(/\\/g, '\\\\')}"
          `;
          
          // Use a temporary script file to avoid command line length limitations
          const tempScriptPath = path.join(tmpDir, `screenshot_script_${timestamp}.ps1`);
          fs.writeFileSync(tempScriptPath, psScript);
          
          // Execute with bypassing execution policy and wait for it to complete
          execSync(`powershell -ExecutionPolicy Bypass -File "${tempScriptPath}"`, {
            timeout: 10000, // 10 seconds timeout
            windowsHide: true
          });
          
          // Clean up temp script file
          try { fs.unlinkSync(tempScriptPath); } catch (e) { /* ignore cleanup errors */ }
          
        } catch (psError) {
          logger.error('PowerShell screenshot failed:', psError);
          
          // Last resort: Try using the built-in Windows Snipping Tool
          try {
            logger.info('Trying Windows Snipping Tool as last resort...');
            
            // Launch Snipping Tool and create a snip that saves to clipboard
            execSync('start ms-screenclip:');
            
            // Wait a moment for user to capture
            logger.info('Please use the Snipping Tool to take a screenshot manually...');
            
            // Show an error message with instructions
            throw new Error('Automatic screenshot failed. Please use the Windows Snipping Tool manually.');
          } catch (snippingError) {
            logger.error('All screenshot methods failed:', snippingError);
            throw new Error('Screenshot failed: No available screenshot method for Windows. Please install nircmd for better results.');
          }
        }
      }
    } else if (process.platform === 'linux') {
      try {
        // Try gnome-screenshot
        execSync(`gnome-screenshot -f "${outputPath}"`);
      } catch (error) {
        // Fallback to scrot
        try {
          execSync(`scrot "${outputPath}"`);
        } catch (scrotError) {
          // Fallback to import from ImageMagick
          execSync(`import -window root "${outputPath}"`);
        }
      }
    } else {
      throw new Error(`Unsupported platform: ${process.platform}`);
    }
    
    // Check if file exists and get file stats
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      const fileSizeInBytes = stats.size;
      const fileSizeInMB = fileSizeInBytes / (1024 * 1024);
      
      // Log screenshot details
      logger.info('Screenshot taken successfully!');
      logger.info(`File: ${filename}`);
      logger.info(`Path: ${outputPath}`);
      logger.info(`Size: ${fileSizeInMB.toFixed(2)} MB`);
      
      // Return file details
      return {
        success: true,
        filename,
        path: outputPath,
        size: `${fileSizeInMB.toFixed(2)} MB`,
        buffer: fs.readFileSync(outputPath)
      };
    } else {
      throw new Error('Screenshot file was not created');
    }
  } catch (error) {
    logger.error('Error taking screenshot:', error);
    throw error;
  }
}

// Function to retrieve a specific screenshot
function getScreenshot(filename) {
  const filePath = path.join(tmpDir, filename);
  
  if (fs.existsSync(filePath)) {
    return {
      success: true,
      path: filePath,
      buffer: fs.readFileSync(filePath)
    };
  } else {
    throw new Error('Screenshot not found');
  }
}

// Function to clean up old screenshots
function cleanupOldScreenshots() {
  try {
    const files = fs.readdirSync(tmpDir);
    const now = Date.now();
    const oneHourAgo = now - config.screenshot.retention;
    
    files.forEach(file => {
      if (file.startsWith('screenshot_')) {
        const filePath = path.join(tmpDir, file);
        const stats = fs.statSync(filePath);
        
        // Remove files older than retention period
        if (stats.mtimeMs < oneHourAgo) {
          fs.unlinkSync(filePath);
          logger.info(`Removed old screenshot: ${file}`);
        }
      }
    });
  } catch (error) {
    logger.error('Error cleaning up old screenshots:', error);
  }
}

// Run cleanup every hour
setInterval(cleanupOldScreenshots, config.screenshot.retention);

module.exports = {
  takeScreenshot,
  getScreenshot,
  cleanupOldScreenshots
};
