const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');
const { createWriteStream } = require('fs');

// Configuration
const NIRCMD_DOWNLOAD_URL = 'https://www.nirsoft.net/utils/nircmd-x64.zip';
const TOOLS_DIR = path.join(__dirname);
const NIRCMD_DIR = path.join(TOOLS_DIR, 'nircmd');
const ZIP_PATH = path.join(TOOLS_DIR, 'nircmd.zip');

console.log('Starting NirCmd installation...');
console.log(`Tools directory: ${TOOLS_DIR}`);

// Ensure directories exist
if (!fs.existsSync(TOOLS_DIR)) {
  fs.mkdirSync(TOOLS_DIR, { recursive: true });
  console.log(`Created tools directory: ${TOOLS_DIR}`);
}

if (!fs.existsSync(NIRCMD_DIR)) {
  fs.mkdirSync(NIRCMD_DIR, { recursive: true });
  console.log(`Created NirCmd directory: ${NIRCMD_DIR}`);
}

// Function to download NirCmd
function downloadNirCmd() {
  console.log(`Downloading NirCmd from ${NIRCMD_DOWNLOAD_URL}...`);
  
  return new Promise((resolve, reject) => {
    const file = createWriteStream(ZIP_PATH);
    https.get(NIRCMD_DOWNLOAD_URL, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download NirCmd: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log('Download completed');
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlinkSync(ZIP_PATH);
        reject(err);
      });
    }).on('error', (err) => {
      if (fs.existsSync(ZIP_PATH)) {
        fs.unlinkSync(ZIP_PATH);
      }
      reject(err);
    });
  });
}

// Function to extract NirCmd
async function extractNirCmd() {
  console.log('Extracting NirCmd...');
  
  try {
    // Check if we have the required modules
    let extractZip;
    try {
      extractZip = require('extract-zip');
    } catch (err) {
      console.log('extract-zip module not found, installing via npm...');
      execSync('npm install extract-zip --no-save');
      extractZip = require('extract-zip');
    }
    
    await extractZip(ZIP_PATH, { dir: NIRCMD_DIR });
    console.log('Extraction completed');
  } catch (err) {
    console.error('Extraction failed:', err);
    
    // Fallback to using unzip if available
    try {
      console.log('Trying alternative extraction method...');
      if (process.platform === 'win32') {
        const powershellCmd = `powershell -command "Expand-Archive -Path '${ZIP_PATH}' -DestinationPath '${NIRCMD_DIR}' -Force"`;
        execSync(powershellCmd);
        console.log('Extraction with PowerShell completed');
      } else {
        // On Linux/macOS
        execSync(`unzip -o "${ZIP_PATH}" -d "${NIRCMD_DIR}"`);
        console.log('Extraction with unzip completed');
      }
    } catch (fallbackErr) {
      console.error('All extraction methods failed:', fallbackErr);
      throw err; // Throw the original error
    }
  }
}

// Function to verify installation
function verifyInstallation() {
  const nircmdExe = path.join(NIRCMD_DIR, 'nircmd.exe');
  
  if (!fs.existsSync(nircmdExe)) {
    throw new Error('NirCmd executable not found after installation');
  }
  
  console.log(`NirCmd installed successfully at: ${nircmdExe}`);
  
  // Create a config file to store the nircmd path
  const configDir = path.join(__dirname, '..', 'backend', 'config');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
    console.log(`Created config directory: ${configDir}`);
  }
  
  const configPath = path.join(configDir, 'nircmd.json');
  fs.writeFileSync(configPath, JSON.stringify({
    path: nircmdExe
  }, null, 2));
  
  console.log(`NirCmd path saved to config: ${configPath}`);
  return nircmdExe;
}

// Function to clean up temporary files
function cleanup() {
  if (fs.existsSync(ZIP_PATH)) {
    fs.unlinkSync(ZIP_PATH);
    console.log('Cleaned up temporary files');
  }
}

// Main install function
async function install() {
  try {
    // Check if NirCmd is already installed
    const nircmdExePath = path.join(NIRCMD_DIR, 'nircmd.exe');
    if (fs.existsSync(nircmdExePath)) {
      console.log('NirCmd is already installed');
      verifyInstallation();
      return;
    }
    
    await downloadNirCmd();
    await extractNirCmd();
    const nircmdPath = verifyInstallation();
    
    // Test NirCmd
    try {
      console.log('Testing NirCmd...');
      execSync(`"${nircmdPath}" beep 500 500`);
      console.log('NirCmd test successful!');
    } catch (err) {
      console.error('NirCmd test failed:', err.message);
      console.log('Installation completed but the test failed. You may need to run the command manually.');
    }
    
    cleanup();
    console.log('NirCmd installation completed successfully');
    
  } catch (error) {
    console.error('Installation failed:', error.message);
    cleanup();
    process.exit(1);
  }
}

// Run installer
install();
