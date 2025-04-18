const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { createLogger } = require('../utils/logger');
const aiService = require('./aiService');

const logger = createLogger('command-service');

// New function to log commands to JSON file
function logCommandToFile(commandData) {
  try {
    const logFilePath = path.join(__dirname, '..', 'logs', 'commandLog.json');
    const logDir = path.dirname(logFilePath);
    
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
      logger.info(`Created logs directory: ${logDir}`);
    }
    
    // Read existing log file or create empty array
    let logEntries = [];
    if (fs.existsSync(logFilePath)) {
      try {
        const fileContent = fs.readFileSync(logFilePath, 'utf8');
        logEntries = JSON.parse(fileContent);
      } catch (err) {
        logger.error(`Error parsing log file: ${err.message}`);
      }
    }
    
    // Add timestamp to command data
    const commandEntry = {
      ...commandData,
      timestamp: new Date().toISOString()
    };
    
    // Add new entry to beginning of array
    logEntries.unshift(commandEntry);
    
    // Keep only latest 1000 entries
    if (logEntries.length > 1000) {
      logEntries = logEntries.slice(0, 1000);
    }
    
    // Write back to file
    fs.writeFileSync(logFilePath, JSON.stringify(logEntries, null, 2), 'utf8');
    logger.info(`Command logged to ${logFilePath}`);
  } catch (error) {
    logger.error(`Failed to log command to file: ${error.message}`);
    // Don't throw - this is a non-critical operation
  }
}

// Get NirCmd path from config or use fallback paths
let nircmdPath = null;
try {
  const configPath = path.join(__dirname, '..', 'config', 'nircmd.json');
  if (fs.existsSync(configPath)) {
    const nircmdConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    nircmdPath = nircmdConfig.path;
    logger.info(`Using NirCmd from config: ${nircmdPath}`);
  }
} catch (error) {
  logger.error(`Error loading NirCmd path: ${error.message}`);
}

// Fallback paths to check if config is not available
if (!nircmdPath) {
  const possiblePaths = [
    path.join(__dirname, '..', '..', 'tools', 'nircmd', 'nircmd.exe'),
    path.join(__dirname, '..', '..', 'tools', 'nircmd.exe'),
    'nircmd.exe' // Default, rely on PATH
  ];
  
  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      nircmdPath = possiblePath;
      logger.info(`Found NirCmd at: ${nircmdPath}`);
      break;
    }
  }
}

// Function to execute a system command
async function executeCommand(command) {
  try {
    // Check if command uses nircmd.exe and we need to replace it
    if (command.includes('nircmd.exe') || command.includes('nircmd ')) {
      if (!nircmdPath) {
        logger.error('Command requires NirCmd but it is not installed');
        throw new Error('NirCmd is not installed. Please run "npm run setup-windows" first');
      }
      
      // Replace nircmd references with the full path
      const safePath = `"${nircmdPath}"`;
      command = command.replace(/nircmd\.exe/g, safePath);
      command = command.replace(/nircmd /g, `${safePath} `);
      logger.info(`Using NirCmd path: ${safePath}`);
    }
    
    logger.info(`Executing command: ${command}`);
    const output = execSync(command, { encoding: 'utf8', shell: true });
    
    // Log the executed command
    logCommandToFile({
      type: 'execute',
      command,
      output: output.substring(0, 1000), // Limit output size
      success: true
    });
    
    return {
      success: true,
      command,
      output
    };
  } catch (error) {
    // Log failed command
    logCommandToFile({
      type: 'execute',
      command,
      error: error.message,
      success: false
    });
    
    logger.error(`Command execution failed: ${error.message}`);
    throw new Error(`Command execution failed: ${error.message}`);
  }
}

// Function to generate a command using AI
async function generateCommand(task) {
  try {
    logger.info(`Generating command for task: ${task}`);
    
    const prompt = `Generate a bash command for ${process.platform} to: ${task}. Only return the command itself without any explanation or markdown.`;
    
    const command = await aiService.queryGroqAI(prompt, {
      currentDirectory: process.cwd(),
      terminalContext: "Command Generation"
    });
    
    // Clean up the response to extract just the command
    const cleanCommand = command.trim().replace(/```[\s\S]*?```/g, '').trim();
    
    // Log the generated command
    logCommandToFile({
      type: 'generate',
      task,
      command: cleanCommand,
      success: true
    });
    
    return {
      success: true,
      task,
      command: cleanCommand
    };
  } catch (error) {
    // Log failed generation
    logCommandToFile({
      type: 'generate',
      task,
      error: error.message,
      success: false
    });
    
    logger.error(`Command generation failed: ${error.message}`);
    throw new Error(`Command generation failed: ${error.message}`);
  }
}

// Function to handle YouTube-related commands
async function openYouTubeVideo(query) {
  try {
    logger.info(`Searching YouTube for: ${query}`);
    
    const videos = await aiService.searchYouTube(query);
    
    if (videos.length === 0) {
      throw new Error("No videos found for your query");
    }
    
    // Get the first video result
    const video = videos[0];
    const videoUrl = `https://www.youtube.com/watch?v=${video.videoId}`;
    
    // Open the video in the default browser using dynamic import
    const openModule = await import('open');
    const open = openModule.default;
    await open(videoUrl);
    
    // Take a screenshot after a delay to allow the browser to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    const screenshot = require('./screenshotService').takeScreenshot();
    
    // Log the YouTube video request
    logCommandToFile({
      type: 'youtube',
      query,
      videoInfo: video,
      videoUrl: videoUrl,
      success: true
    });
    
    return {
      success: true,
      videoInfo: video,
      videoUrl: videoUrl,
      screenshot: screenshot.buffer
    };
  } catch (error) {
    // Log failed YouTube request
    logCommandToFile({
      type: 'youtube',
      query,
      error: error.message,
      success: false
    });
    
    logger.error(`Error opening YouTube video: ${error.message}`);
    throw error;
  }
}

// Function to generate, execute a command and take a screenshot
async function processTextCommand(text) {
  try {
    logger.info(`Processing text as command: ${text}`);
    
    // Check if this is a calendar-related request
    const isCalendarRequest = /calendar|schedule|event|meeting|appointment|remind/i.test(text);
    
    // Check if this is a YouTube or video playback request
    const isYouTubeRequest = /youtube|play|watch|video/i.test(text);
    
    if (isCalendarRequest) {
      logger.info(`Detected calendar request: ${text}`);
      
      try {
        // Use the calendar manager to handle the request
        const calendarManager = require('./calendarManager');
        const result = await calendarManager.handleNaturalLanguageInput(text);
        
        // Log the calendar action
        logCommandToFile({
          type: 'calendar',
          text,
          event: result,
          success: true
        });
        
        return {
          success: true,
          type: 'calendar',
          text,
          event: result
        };
      } catch (error) {
        // Handle authorization errors with auto-open flow
        if (error.message.includes('Not authorized')) {
          const calendarManager = require('./calendarManager');
          const authUrl = await calendarManager.authorize();
          
          // Log that we're directing to authorization
          logCommandToFile({
            type: 'calendar-auth',
            text,
            error: 'Authorization required',
            authUrl,
            success: false
          });
          
          // Create a result that will trigger automatic browser opening
          return {
            success: false,
            type: 'calendar-auth',
            text,
            needsAuth: true,
            authUrl
          };
        }
        throw error;
      }
    }
    
    if (isYouTubeRequest) {
      logger.info(`Detected YouTube request: ${text}`);
      // Extract the search query by removing YouTube-related keywords
      const searchQuery = text
        .replace(/(?:search|find|play|watch|on|youtube|video|for|me)/gi, '')
        .trim();
      
      logger.info(`Extracted YouTube search query: "${searchQuery}"`);
      
      // Use the openYouTubeVideo function directly
      const result = await openYouTubeVideo(searchQuery);
      
      // After successful processing, log the complete operation
      logCommandToFile({
        type: 'youtube-text',
        text,
        command: `YouTube search: ${searchQuery}`,
        output: 'Video played',
        success: true
      });
      
      return result;
    }
    
    // For non-YouTube and non-calendar requests, proceed with the original command generation flow
    // Generate command using AI
    const generatedResult = await generateCommand(text);
    const command = generatedResult.command;
    
    // Execute the command
    const executionResult = await executeCommand(command);
    
    // Take a screenshot after a short delay to capture the result
    await new Promise(resolve => setTimeout(resolve, 2000));
    const screenshot = require('./screenshotService').takeScreenshot();
    
    // After successful processing, log the complete operation
    logCommandToFile({
      type: 'process-text',
      text,
      command,
      output: executionResult.output.substring(0, 1000),
      success: true
    });
    
    return {
      success: true,
      text,
      command,
      output: executionResult.output,
      screenshot: screenshot.buffer
    };
  } catch (error) {
    // Log failed processing
    logCommandToFile({
      type: 'process-text',
      text,
      error: error.message,
      success: false
    });
    
    logger.error(`Command processing failed: ${error.message}`);
    throw new Error(`Command processing failed: ${error.message}`);
  }
}

module.exports = {
  executeCommand,
  generateCommand,
  openYouTubeVideo,
  processTextCommand
};
