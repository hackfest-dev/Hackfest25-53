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

// Speech-to-Text with Whisper (unchanged)
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
