const { createLogger } = require('../utils/logger');
const aiService = require('../services/aiService');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const logger = createLogger('ai-controller');

// Configure multer for temporary storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

/**
 * Get daily AI tip for the user
 */
exports.getDailyTip = async (req, res) => {
  try {
    const userId = req.user?.uid || 'anonymous';
    const prompt = `
      Generate a short, helpful productivity tip for a knowledge worker.
      Make it practical, specific, and actionable.
      Keep it under 150 characters.
    `;
    
    const tip = await aiService.queryGroqAI(prompt, {
      currentDirectory: '',
      terminalContext: 'daily tip'
    });
    
    return res.json({
      success: true,
      tip
    });
  } catch (error) {
    logger.error(`Error generating daily tip: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to generate tip',
      message: error.message
    });
  }
};

/**
 * Transcribe audio using Whisper
 */
exports.transcribeAudio = async (req, res) => {
  try {
    logger.info('Received audio transcription request');
    
    if (!req.body || !req.body.audio) {
      logger.error('No audio data provided in request body');
      return res.status(400).json({
        success: false,
        error: 'No audio data provided in request'
      });
    }
    
    // Log some details about the audio data for debugging
    const audioDataLength = req.body.audio.length;
    logger.info(`Audio data received: ${audioDataLength} characters`);
    
    // Decode base64 audio data
    try {
      const audioBuffer = Buffer.from(req.body.audio, 'base64');
      logger.info(`Decoded base64 to buffer of length: ${audioBuffer.length}`);
      
      // Check if buffer is valid
      if (audioBuffer.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid audio data: empty buffer after decoding'
        });
      }
      
      // Call Whisper service to transcribe
      logger.info('Calling transcribeAudio service function');
      const transcription = await aiService.transcribeAudio(audioBuffer);
      
      if (!transcription || transcription.startsWith('Error:')) {
        logger.error(`Transcription service error: ${transcription}`);
        return res.status(500).json({
          success: false,
          error: transcription || 'Failed to transcribe audio'
        });
      }
      
      logger.info('Audio transcription completed successfully');
      logger.info(`Transcription result: "${transcription}"`);
      
      return res.json({
        success: true,
        text: transcription
      });
    } catch (decodeError) {
      logger.error(`Error decoding audio data: ${decodeError.message}`);
      return res.status(400).json({
        success: false,
        error: 'Invalid audio data: could not decode base64',
        details: decodeError.message
      });
    }
  } catch (error) {
    logger.error(`Error in audio transcription: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Failed to transcribe audio',
      message: error.message
    });
  }
};

/**
 * Process image with AI
 */
exports.processImage = async (req, res) => {
  try {
    // Use multer middleware to handle the file upload
    upload.single('image')(req, res, async (err) => {
      if (err) {
        logger.error(`Upload error: ${err.message}`);
        return res.status(400).json({
          success: false,
          error: 'File upload failed',
          message: err.message
        });
      }
      
      if (!req.file || !req.file.buffer) {
        logger.error('No image file received');
        return res.status(400).json({
          success: false,
          error: 'No image file received'
        });
      }
      
      const prompt = req.body.prompt || 'Describe this image in detail';
      
      try {
        // Convert buffer to base64
        const base64Image = req.file.buffer.toString('base64');
        
        // Process the image with OpenAI
        const result = await aiService.handleImageWithOpenAI(prompt, base64Image);
        
        return res.json({
          success: true,
          result
        });
      } catch (imageError) {
        logger.error(`Image processing error: ${imageError.message}`);
        return res.status(500).json({
          success: false,
          error: 'Image processing failed',
          message: imageError.message
        });
      }
    });
  } catch (error) {
    logger.error(`General image processing error: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Image processing failed',
      message: error.message
    });
  }
};
