const axios = require('axios');
const { createLogger } = require('../utils/logger');
const config = require('../config/config');

const logger = createLogger('ai-service');

// Function to query Gemini AI
async function queryGeminiAI(prompt, context = {}) {
  try {
    // Gemini API endpoint
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${config.apiKeys.google}`;
    
    // Format the context as a string
    const contextStr = `
    Current Directory: ${context.currentDirectory || 'Unknown'}
    Terminal Context: ${context.terminalContext || 'None'}
    
    Recent Commands: ${context.recentCommands || 'None'}
    `;
    
    logger.info("Calling Gemini API with context");
    
    // Prepare request body based on whether screenshot is included
    const requestBody = {
      contents: [{
        role: "user",
        parts: []
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      }
    };
    
    // Add text context
    requestBody.contents[0].parts.push({
      text: `${contextStr}\n\nUser Question: ${prompt}`
    });
    
    // If screenshot is available, add as image part
    if (context.screenshot) {
      // Remove the data:image/png;base64, prefix if present
      const base64Image = context.screenshot.includes(',') 
        ? context.screenshot.split(',')[1] 
        : context.screenshot;
        
      requestBody.contents[0].parts.push({
        inline_data: {
          mime_type: "image/png",
          data: base64Image
        }
      });
    }
    
    const response = await axios.post(url, requestBody, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    logger.info("API response received successfully");
    
    // Handle the response structure
    if (response.data.candidates && 
        response.data.candidates.length > 0 && 
        response.data.candidates[0].content && 
        response.data.candidates[0].content.parts && 
        response.data.candidates[0].content.parts.length > 0) {
      return response.data.candidates[0].content.parts[0].text;
    }
    
    // Fallback message
    return "Sorry, I couldn't generate a response. Please try again.";
  } catch (error) {
    logger.error("Gemini API Error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

// Function to search YouTube
async function searchYouTube(query, maxResults = 5) {
  try {
    const { google } = require('googleapis');
    const youtube = google.youtube({
      version: 'v3',
      auth: config.apiKeys.youtube
    });
    
    logger.info(`Searching YouTube for: ${query}`);
    
    const response = await youtube.search.list({
      part: 'snippet',
      q: query,
      maxResults: maxResults,
      type: 'video'
    });
    
    return response.data.items.map(item => ({
      title: item.snippet.title,
      videoId: item.id.videoId,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      thumbnailUrl: item.snippet.thumbnails.high.url
    }));
  } catch (error) {
    logger.error("YouTube API Error:", error);
    throw new Error(`YouTube search failed: ${error.message}`);
  }
}

// Text-to-Speech with ElevenLabs
async function textToSpeech(text) {
  try {
    const response = await axios.post(
      'https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL',
      {
        text: text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8
        }
      },
      {
        headers: {
          'xi-api-key': config.apiKeys.elevenLabs,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );

    // Convert to WhatsApp-compatible format
    return Buffer.from(response.data, 'binary');
    
  } catch (error) {
    logger.error("TTS error:", error);
    throw new Error("Failed to generate audio");
  }
}

// Speech-to-Text with Whisper
async function transcribeAudio(buffer) {
  const fs = require('fs').promises;
  const path = require('path');
  const { execSync } = require('child_process');
  
  try {
    const tempDir = path.join(__dirname, '..', 'tmp');
    await fs.mkdir(tempDir, { recursive: true });

    const inputFile = path.join(tempDir, `input_${Date.now()}.webm`);
    const wavFile = path.join(tempDir, `audio_${Date.now()}.wav`);
    const outputFile = path.join(tempDir, `audio_${Date.now()}.txt`);

    // Write input file using promises
    await fs.writeFile(inputFile, buffer);

    // Convert to WAV format
    await new Promise((resolve, reject) => {
      require('fluent-ffmpeg')(inputFile)
        .audioFrequency(16000)
        .audioChannels(1)
        .format('wav')
        .save(wavFile)
        .on('end', resolve)
        .on('error', reject);
    });

    // Transcribe using Whisper
    execSync(`whisper "${wavFile}" --model small --output_format txt --output_dir "${tempDir}"`);

    // Read and clean up files
    const result = await fs.readFile(outputFile, 'utf-8');
    await Promise.all([
      fs.unlink(inputFile),
      fs.unlink(wavFile),
      fs.unlink(outputFile)
    ]);

    return result.trim();
  } catch (error) {
    logger.error("Local transcription error:", error);
    throw new Error("Transcription failed: " + error.message);
  }
}

module.exports = {
  queryGeminiAI,
  searchYouTube,
  textToSpeech,
  transcribeAudio
};
