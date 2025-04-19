const axios = require('axios');
const { createLogger } = require('../utils/logger');
const config = require('../config/config');
const { Groq } = require('groq-sdk');

const logger = createLogger('ai-service');

// Initialize Groq client
const groq = new Groq({
  apiKey: config.apiKeys.groq
});

// Function to query Groq (replacing Gemini)
async function queryGroqAI(prompt, context = {}) {
  try {
    // Format the context as a string
    const contextStr = `
    Current Directory: ${context.currentDirectory || 'Unknown'}
    Terminal Context: ${context.terminalContext || 'None'}
    
    Recent Commands: ${context.recentCommands || 'None'}
    `;
    
    logger.info("Calling Groq API with context");
    
    let messages = [
      {
        role: "system",
        content: "You are a helpful assistant that provides accurate and concise information about technical questions."
      },
      {
        role: "user",
        content: `${contextStr}\n\nUser Question: ${prompt}`
      }
    ];
    
    // Note: Groq doesn't support image input directly like Gemini or OpenAI
    // If screenshot is available, we'll need to handle it differently or use a different service
    if (context.screenshot) {
      logger.info("Screenshot provided but Groq doesn't support image input directly. Processing text only.");
      messages.push({
        role: "user",
        content: "Note: I also shared a screenshot with you, but I understand you can't view it. Please help based on the text information provided."
      });
    }
    
    // Call Groq API
    const response = await groq.chat.completions.create({
      model: "llama3-70b-8192", // Groq supports various models including Llama 3, Mixtral, etc.
      messages: messages,
      max_tokens: 1024,
      temperature: 0.7,
      top_p: 0.95
    });
    
    logger.info("API response received successfully");
    
    if (response.choices && response.choices.length > 0) {
      return response.choices[0].message.content;
    }
    
    // Fallback message
    return "Sorry, I couldn't generate a response. Please try again.";
  } catch (error) {
    logger.error("Groq API Error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

// Function to search YouTube (unchanged)
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

// Text-to-Speech with ElevenLabs (unchanged)
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

// Speech-to-Text with Whisper - updated to match bot.cjs implementation
async function transcribeAudio(buffer) {
  const fs = require('fs').promises;
  const path = require('path');
  const { execSync } = require('child_process');
  
  try {
    logger.info('Starting audio transcription');
    
    // Validate input
    if (!buffer || !Buffer.isBuffer(buffer)) {
      logger.error('Invalid input buffer for transcription');
      throw new Error('Invalid input buffer for transcription');
    }
    
    logger.info(`Received ${buffer.length} bytes of audio data`);
    
    const tempDir = path.join(__dirname, '..', 'tmp');
    await fs.mkdir(tempDir, { recursive: true });

    const timestamp = Date.now();
    const audioFilename = `audio_${timestamp}`;
    const inputFile = path.join(tempDir, `input_${timestamp}.webm`);
    const wavFile = path.join(tempDir, `${audioFilename}.wav`);
    
    // Important: Whisper will create an output file based on the input filename
    // The actual output file will be named with the base name of the input WAV file
    // For example: if input is "audio_12345.wav", output will be "audio_12345.txt"
    const expectedOutputFile = path.join(tempDir, `${audioFilename}.txt`);

    // Write input file using promises
    await fs.writeFile(inputFile, buffer);
    logger.info(`Audio file written to ${inputFile}`);

    // Convert to WAV format
    logger.info('Converting audio to WAV format');
    await new Promise((resolve, reject) => {
      require('fluent-ffmpeg')(inputFile)
        .audioFrequency(16000)
        .audioChannels(1)
        .format('wav')
        .save(wavFile)
        .on('end', resolve)
        .on('error', (err) => {
          logger.error('ffmpeg error:', err);
          reject(err);
        });
    });

    // Direct approach: attempt to transcribe using Whisper without pre-checking
    try {
      logger.info(`Transcribing audio with Whisper: ${wavFile}`);
      
      // Run whisper command
      execSync(`whisper "${wavFile}" --model small --output_format txt --output_dir "${tempDir}"`);
      
      // Check if the output file exists
      let outputExists = false;
      try {
        await fs.access(expectedOutputFile);
        outputExists = true;
      } catch (accessError) {
        logger.warn(`Expected output file not found at: ${expectedOutputFile}`);
        // Try an alternative filename pattern that Whisper might have used
        const alternativeOutputFile = path.join(tempDir, `${path.basename(wavFile)}.txt`);
        logger.info(`Trying alternative output file: ${alternativeOutputFile}`);
        
        try {
          await fs.access(alternativeOutputFile);
          logger.info(`Found output at alternative location: ${alternativeOutputFile}`);
          // If we found the file at the alternative location, update our expected path
          outputExists = true;
          // Update the expected output file path to the alternative one we found
          expectedOutputFile = alternativeOutputFile;
        } catch (altAccessError) {
          // Neither file exists
          logger.error(`Output file not found at either expected location`);
        }
      }
      
      if (!outputExists) {
        // Look for any txt files in the temp directory that could match our output
        const dirFiles = await fs.readdir(tempDir);
        const txtFiles = dirFiles.filter(f => f.endsWith('.txt') && f.includes(audioFilename));
        
        if (txtFiles.length > 0) {
          // Use the first matching txt file we find
          const foundFile = txtFiles[0];
          logger.info(`Found potential output file: ${foundFile}`);
          expectedOutputFile = path.join(tempDir, foundFile);
          outputExists = true;
        } else {
          throw new Error('Whisper ran but no output file was found');
        }
      }
      
      // If we get here, Whisper executed successfully and we found an output file
      logger.info(`Reading transcription result from: ${expectedOutputFile}`);
      const result = await fs.readFile(expectedOutputFile, 'utf-8');
      
      // Clean up files
      try {
        await Promise.all([
          fs.unlink(inputFile),
          fs.unlink(wavFile),
          fs.unlink(expectedOutputFile)
        ]);
        logger.info('Temporary files cleaned up successfully');
      } catch (cleanupError) {
        logger.warn(`File cleanup error: ${cleanupError.message}`);
      }
      
      return result.trim();
    } catch (whisperError) {
      // Whisper failed - check if it's because it's not installed
      logger.error('Whisper execution failed:', whisperError.message);
      
      if (whisperError.message.includes('not found') || 
          whisperError.message.includes('command not found') || 
          whisperError.message.includes('No such file or directory')) {
        throw new Error('Whisper AI is not installed on the server. Please install Whisper AI to enable audio transcription.');
      } else {
        throw new Error(`Whisper transcription error: ${whisperError.message}`);
      }
    }
  } catch (error) {
    logger.error("Transcription error:", error);
    
    // Return a user-friendly error message
    if (error.message.includes('Whisper AI is not installed')) {
      return 'Error: Whisper AI is not installed on the server. Please check the installation guide in the documentation.';
    } else if (error.message.includes('ffmpeg')) {
      return 'Error: Could not convert audio format. Please check if ffmpeg is installed.';
    } else {
      return `Transcription failed: ${error.message}`;
    }
  }
}

// Alternative implementation for image handling with OpenAI
async function handleImageWithOpenAI(prompt, imageBase64) {
  try {
    const { OpenAI } = require('openai');
    const openai = new OpenAI({
      apiKey: config.apiKeys.openai
    });
    
    // Remove the data:image/png;base64, prefix if present
    const base64Image = imageBase64.includes(',') 
      ? imageBase64.split(',')[1] 
      : imageBase64;
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 1024
    });
    
    if (response.choices && response.choices.length > 0) {
      return response.choices[0].message.content;
    }
    
    return "Sorry, I couldn't analyze the image. Please try again.";
  } catch (error) {
    logger.error("OpenAI Vision API Error:", error);
    throw new Error("Image analysis failed: " + error.message);
  }
}

module.exports = {
  queryGroqAI, // Renamed from queryGeminiAI
  searchYouTube,
  textToSpeech,
  transcribeAudio,
  handleImageWithOpenAI // Added for image handling
};
