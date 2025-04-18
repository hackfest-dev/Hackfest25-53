const { execSync } = require('child_process');
const { createLogger } = require('../utils/logger');
const aiService = require('./aiService');

const logger = createLogger('command-service');

// Function to execute a system command
async function executeCommand(command) {
  try {
    logger.info(`Executing command: ${command}`);
    const output = execSync(command, { encoding: 'utf8' });
    
    return {
      success: true,
      command,
      output
    };
  } catch (error) {
    logger.error(`Command execution failed: ${error.message}`);
    throw new Error(`Command execution failed: ${error.message}`);
  }
}

// Function to generate a command using AI
async function generateCommand(task) {
  try {
    logger.info(`Generating command for task: ${task}`);
    
    const prompt = `Generate a bash command for ${process.platform} to: ${task}. Only return the command itself without any explanation or markdown.`;
    
    const command = await aiService.queryGeminiAI(prompt, {
      currentDirectory: process.cwd(),
      terminalContext: "Command Generation"
    });
    
    // Clean up the response to extract just the command
    const cleanCommand = command.trim().replace(/```[\s\S]*?```/g, '').trim();
    
    return {
      success: true,
      task,
      command: cleanCommand
    };
  } catch (error) {
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
    
    // Open the video in the default browser
    const open = require('open');
    await open(videoUrl);
    
    // Take a screenshot after a delay to allow the browser to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    const screenshot = require('./screenshotService').takeScreenshot();
    
    return {
      success: true,
      videoInfo: video,
      videoUrl: videoUrl,
      screenshot: screenshot.buffer
    };
  } catch (error) {
    logger.error(`Error opening YouTube video: ${error.message}`);
    throw error;
  }
}

module.exports = {
  executeCommand,
  generateCommand,
  openYouTubeVideo
};
