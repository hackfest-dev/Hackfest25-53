const commandService = require('../services/commandService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('command-controller');

// Controller to execute a system command
const executeCommand = async (req, res) => {
  try {
    const { command } = req.body;
    
    if (!command) {
      return res.status(400).json({
        success: false,
        message: 'Command is required'
      });
    }
    
    const result = await commandService.executeCommand(command);
    
    return res.status(200).json({
      success: true,
      message: 'Command executed successfully',
      command: result.command,
      output: result.output
    });
  } catch (error) {
    logger.error('Error executing command:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to execute command',
      error: error.message
    });
  }
};

// Controller to generate a command using AI
const generateCommand = async (req, res) => {
  try {
    const { task } = req.body;
    
    if (!task) {
      return res.status(400).json({
        success: false,
        message: 'Task description is required'
      });
    }
    
    const result = await commandService.generateCommand(task);
    
    return res.status(200).json({
      success: true,
      message: 'Command generated successfully',
      task: result.task,
      command: result.command
    });
  } catch (error) {
    logger.error('Error generating command:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate command',
      error: error.message
    });
  }
};

// Controller to open YouTube video
const openYouTubeVideo = async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }
    
    const result = await commandService.openYouTubeVideo(query);
    
    return res.status(200).json({
      success: true,
      message: 'YouTube video opened successfully',
      videoInfo: result.videoInfo,
      videoUrl: result.videoUrl
    });
  } catch (error) {
    logger.error('Error opening YouTube video:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to open YouTube video',
      error: error.message
    });
  }
};

module.exports = {
  executeCommand,
  generateCommand,
  openYouTubeVideo
};
