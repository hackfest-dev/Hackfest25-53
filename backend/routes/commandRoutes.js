const express = require('express');
const commandService = require('../services/commandService');
const { createLogger } = require('../utils/logger');

const router = express.Router();
const logger = createLogger('command-routes');

// Execute command route
router.post('/execute', async (req, res) => {
  try {
    const { command } = req.body;
    
    if (!command) {
      return res.status(400).json({ 
        success: false, 
        message: 'Command is required' 
      });
    }
    
    logger.info(`Executing command: ${command}`);
    const result = await commandService.executeCommand(command);
    
    return res.json({
      success: true,
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
});

// Generate command route
router.post('/generate', async (req, res) => {
  try {
    const { task } = req.body;
    
    if (!task) {
      return res.status(400).json({ 
        success: false, 
        message: 'Task description is required' 
      });
    }
    
    logger.info(`Generating command for task: ${task}`);
    const result = await commandService.generateCommand(task);
    
    return res.json({
      success: true,
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
});

// Add a new route for YouTube video playback
router.post('/youtube', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ 
        success: false, 
        message: 'Search query is required' 
      });
    }
    
    logger.info(`Processing YouTube request: ${query}`);
    const result = await commandService.openYouTubeVideo(query);
    
    return res.json({
      success: true,
      videoInfo: result.videoInfo,
      videoUrl: result.videoUrl
    });
  } catch (error) {
    logger.error('Error processing YouTube request:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to play YouTube video',
      error: error.message 
    });
  }
});

// Handle calendar command
router.post('/calendar', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Text is required'
      });
    }
    
    const calendarManager = require('../services/calendarManager');
    
    try {
      const event = await calendarManager.handleNaturalLanguageInput(text);
      
      res.json({
        success: true,
        event,
        calendarLink: event.htmlLink
      });
    } catch (error) {
      if (error.message.includes('Not authorized')) {
        const authUrl = await calendarManager.authorize();
        return res.status(401).json({
          success: false,
          error: 'Google Calendar authorization required',
          authUrl
        });
      }
      
      throw error;
    }
  } catch (error) {
    console.error('Error handling calendar command:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process calendar command',
      error: error.message
    });
  }
});

module.exports = router;
