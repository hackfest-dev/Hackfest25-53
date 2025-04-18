const express = require('express');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Ensure tmp directory exists
const tmpDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

// Screenshot endpoint
app.get('/api/screenshot', (req, res) => {
  try {
    // Generate unique filename based on timestamp
    const timestamp = Date.now();
    const filename = `screenshot_${timestamp}.png`;
    const outputPath = path.join(tmpDir, filename);
    
    console.log(`Taking screenshot and saving to: ${outputPath}`);
    
    // Take screenshot using different commands based on OS
    if (process.platform === 'darwin') {
      // macOS
      execSync(`screencapture -x "${outputPath}"`);
    } else if (process.platform === 'win32') {
      try {
        // Try nircmd first (if installed)
        execSync(`nircmd savescreenshot "${outputPath}"`);
      } catch (error) {
        console.log('nircmd not found, using PowerShell fallback...');
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
          `;
          
          // Use a temporary script file to avoid command line length limitations
          const tempScriptPath = path.join(tmpDir, `screenshot_script_${timestamp}.ps1`);
          fs.writeFileSync(tempScriptPath, psScript);
          
          // Execute with bypassing execution policy
          execSync(`powershell -ExecutionPolicy Bypass -File "${tempScriptPath}"`, {
            timeout: 10000 // 10 seconds timeout
          });
          
          // Clean up temp script file
          try { fs.unlinkSync(tempScriptPath); } catch (e) { /* ignore cleanup errors */ }
        } catch (psError) {
          console.error('PowerShell screenshot failed:', psError);
          throw new Error('No screenshot method available for Windows. Try installing nircmd or use browser screenshot.');
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
      
      // Log screenshot details to console
      console.log('Screenshot taken successfully!');
      console.log(`File: ${filename}`);
      console.log(`Path: ${outputPath}`);
      console.log(`Size: ${fileSizeInMB.toFixed(2)} MB`);
      
      // Read file as base64 for console preview (optional)
      const fileBuffer = fs.readFileSync(outputPath);
      const base64Image = fileBuffer.toString('base64').substring(0, 100) + '...'; // Truncated for console
      console.log(`Base64 Preview: ${base64Image}`);
      
      // Return success response with file details
      return res.status(200).json({
        success: true,
        message: 'Screenshot captured successfully',
        filename,
        path: outputPath,
        size: `${fileSizeInMB.toFixed(2)} MB`
      });
    } else {
      throw new Error('Screenshot file was not created');
    }
  } catch (error) {
    console.error('Error taking screenshot:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to take screenshot',
      error: error.message,
      solution: "You can try using the 'Browser Screenshot' option instead"
    });
  }
});

// Endpoint to save a browser-based screenshot
app.post('/api/browser-screenshot', (req, res) => {
  try {
    const { imageData } = req.body;
    
    if (!imageData) {
      return res.status(400).json({
        success: false,
        message: 'No image data provided'
      });
    }
    
    // Extract the base64 data (remove data:image/png;base64, prefix)
    const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
    
    // Generate unique filename
    const timestamp = Date.now();
    const filename = `screenshot_${timestamp}.png`;
    const outputPath = path.join(tmpDir, filename);
    
    // Save the image
    fs.writeFileSync(outputPath, Buffer.from(base64Data, 'base64'));
    
    // Get file stats
    const stats = fs.statSync(outputPath);
    const fileSizeInBytes = stats.size;
    const fileSizeInMB = fileSizeInBytes / (1024 * 1024);
    
    console.log('Browser screenshot saved successfully!');
    console.log(`File: ${filename}`);
    console.log(`Path: ${outputPath}`);
    console.log(`Size: ${fileSizeInMB.toFixed(2)} MB`);
    
    return res.status(200).json({
      success: true,
      message: 'Browser screenshot saved successfully',
      filename,
      path: outputPath,
      size: `${fileSizeInMB.toFixed(2)} MB`
    });
  } catch (error) {
    console.error('Error saving browser screenshot:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save browser screenshot',
      error: error.message
    });
  }
});

// Endpoint to retrieve a specific screenshot
app.get('/api/screenshot/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(tmpDir, filename);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({
      success: false,
      message: 'Screenshot not found'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Screenshot server running on port ${PORT}`);
  console.log(`Access the screenshot endpoint at: http://localhost:${PORT}/api/screenshot`);
});

// Cleanup function to remove old screenshots
function cleanupOldScreenshots() {
  try {
    const files = fs.readdirSync(tmpDir);
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000); // 1 hour in milliseconds
    
    files.forEach(file => {
      if (file.startsWith('screenshot_')) {
        const filePath = path.join(tmpDir, file);
        const stats = fs.statSync(filePath);
        
        // Remove files older than 1 hour
        if (stats.mtimeMs < oneHourAgo) {
          fs.unlinkSync(filePath);
          console.log(`Removed old screenshot: ${file}`);
        }
      }
    });
  } catch (error) {
    console.error('Error cleaning up old screenshots:', error);
  }
}

// Run cleanup every hour
setInterval(cleanupOldScreenshots, 60 * 60 * 1000);