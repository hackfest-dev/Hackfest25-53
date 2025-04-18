// bot.js
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const fs = require('fs').promises;
const pino = require("pino");
const axios = require("axios");
const util = require('util');
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
const { execSync } = require('child_process');
const path = require('path');
// Create a client for Google Text-to-Speech
const ttsClient = new TextToSpeechClient();
const { google } = require('googleapis');





// AI Service configuration
const API_KEY = 'AIzaSyDM2UQbO2gV33ImPMWoFXw3F19xZdFqVtk';



// Add to bot.js
// Modified call handler
// Updated voice message handler
async function handleVoiceMessage(msg, sock) {
  const { downloadContentFromMessage, toBuffer } = require('@whiskeysockets/baileys');
  const sender = msg.key.remoteJid;
  
  try {
    if (!msg.message?.audioMessage) throw new Error("Not a voice message");
    
    // Show recording indicator when processing starts
    await sock.sendPresenceUpdate('recording', sender);
    
    // Download audio
    const stream = await downloadContentFromMessage(msg.message.audioMessage, 'audio');
    const buffer = await toBuffer(stream);

    // Transcribe using local Whisper
    const transcription = await transcribeAudio(buffer);
    console.log('🎤 Transcription:', transcription);

    // Process with AI
    const aiResponse = await queryGroqAI(transcription);
    const responseAudio = await textToSpeech(aiResponse);

    // Send voice response
    await sock.sendMessage(sender, {
      audio: responseAudio,
      mimetype: 'audio/mpeg',
      ptt: true
    });

    // Hide recording indicator after successful response
    await sock.sendPresenceUpdate('paused', sender);

  } catch (error) {
    console.error("Error:", error);
    // Ensure indicator is cleared on error
    await sock.sendPresenceUpdate('paused', sender);
    await sock.sendMessage(sender, { 
      text: `❌ Error: ${error.message}` 
    });
  }
}







// Add this to your messages.upsert handler



// Update your call event listener



// Updated call event listener




// Speech-to-Text with Whisper
async function transcribeAudio(buffer) {
  try {
    const tempDir = path.join(__dirname, 'tmp');
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
    console.error("Local transcription error:", error);
    throw new Error("Transcription failed: " + error.message);
  }
}
const ELEVEN_LABS_API_KEY = 'sk_077ac0cdba28d0ae3ede52c2b8671f8ba8a9a6f99f41d2e8'; 
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
          'xi-api-key': 'sk_077ac0cdba28d0ae3ede52c2b8671f8ba8a9a6f99f41d2e8',
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );

    // Convert to WhatsApp-compatible format
    return Buffer.from(response.data, 'binary');
    
  } catch (error) {
    console.error("TTS error:", error);
    throw new Error("Failed to generate audio");
  }
}



async function openAndScreenshot(query) {
  try {
    // Improved prompt for application/file/folder handling
    const prompt = `Generate macOS bash command to open: ${query}. 
      Rules:
      1. For apps: Use 'open -a "Application Name"'
      2. For files/folders: Use full path with 'open' 
      3. Add '-R' flag to reveal in Finder if path contains spaces
      4. Always quote special characters
      Only return the command.`;

    const openCommand = await queryGroqAI(prompt, {
      currentDirectory: "/Users",
      terminalContext: "File Navigation"
    });

    console.log(`Generated command: ${openCommand}`);
    
    // Execute with error handling
    const { stdout, stderr } = await executeBashCommand(openCommand.trim());
    
    if (stderr) throw new Error(stderr);
    
    // Dynamic wait based on file type
    const waitTime = openCommand.includes("-a") ? 5000 : 3000;
    console.log(`Waiting ${waitTime}ms for content to load...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    // Screenshot with metadata
    const screenshot = await takeScreenshot({
      format: "png",
      captureCursor: false,
      debugLog: true
    });
    
    return {
      success: true,
      screenshot,
      command: openCommand.trim(),
      openedItem: query
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      success: false,
      error: `Failed to open: ${error.message}`,
      suggestion: this.getTroubleshootingTips(query)
    };
  }
}



// Helper function with error handling
async function takeScreenshot() {
    try {
      const { exec } = require('child_process');
      const path = require('path');
      const fs = require('fs').promises;
      
      // Path to save screenshot
      const screenshotPath = path.join(__dirname, 'screenshot.png');
      
      // Use screencapture on macOS (since you're on Mac M2)
      return new Promise((resolve, reject) => {
        exec(`screencapture -x "${screenshotPath}"`, async (error) => {
          if (error) {
            reject(error);
            return;
          }
          
          try {
            // Read the file as buffer
            const buffer = await fs.readFile(screenshotPath);
            // Delete the file after reading
            await fs.unlink(screenshotPath);
            resolve(buffer);
          } catch (err) {
            reject(err);
          }
        });
      });
    } catch (error) {
      console.error("Error taking screenshot:", error);
      throw error;
    }
  }
  
  
  async function searchYouTube(query, maxResults = 5) {
    try {
      const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
      const API_KEY = 'AIzaSyBMAQdSNhNnTiGT7Jqq65S14AgV4wmZDKM'; // Better to use environment variables
      
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=${maxResults}&q=${encodeURIComponent(query)}&key=${API_KEY}&type=video`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(`YouTube API Error: ${data.error.message}`);
      }
      
      return data.items.map(item => ({
        title: item.snippet.title,
        videoId: item.id.videoId,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
        thumbnailUrl: item.snippet.thumbnails.high.url
      }));
    } catch (error) {
      console.error("Error searching YouTube:", error);
      throw error;
    }
  }
  
  // Function to open a YouTube video
  async function openYouTubeVideo(query) {
    try {
      const { exec } = require('child_process');
      const open = require('open'); // You'll need to install this package
      
      // First search for videos
      const videos = await searchYouTube(query);
      
      if (videos.length === 0) {
        return {
          success: false,
          error: "No videos found for your query"
        };
      }
      
      // Get the first video result
      const video = videos[0];
      const videoUrl = `https://www.youtube.com/watch?v=${video.videoId}`;
      
      // Open the video in the default browser
      await open(videoUrl);
      
      // Take a screenshot after a delay to allow the browser to load
      await new Promise(resolve => setTimeout(resolve, 3000));
      const screenshot = await takeScreenshot();
      
      return {
        success: true,
        videoInfo: video,
        videoUrl: videoUrl,
        screenshot: screenshot
      };
    } catch (error) {
      console.error("Error opening YouTube video:", error);
      return {
        success: false,
        error: error.message || "Failed to open YouTube video"
      };
    }
  }


// Function to query Gemini AI
async function queryGroqAI(prompt, context = {}) {
  try {
    // Gemini API endpoint
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${API_KEY}`;
    
    // Format the context as a string
    const contextStr = `
    Current Directory: ${context.currentDirectory || 'Unknown'}
    Terminal Context: ${context.terminalContext || 'None'}
    
    Recent Commands: ${context.recentCommands || 'None'}
    `;
    
    console.log("Calling Gemini API with:", { 
      url, 
      contextLength: contextStr.length,
      hasScreenshot: !!context.screenshot
    });
    
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
      // Remove the data:image/png;base64, prefix
      const base64Image = context.screenshot.split(',')[1];
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
    
    console.log("API Success Response:", response.data);
    
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
    console.error("Gemini API Error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}


// Add these functions to your bot.js file

// Helper function to generate bash commands using AI
async function generateBashCommand(task) {
    try {
      const prompt = `Generate a bash command for macOS M2 to: ${task}. Only return the command itself without any explanation or markdown.`;
      
      // Use the existing Gemini AI function
      const command = await queryGroqAI(prompt, {
        currentDirectory: "/whatsapp/commands",
        terminalContext: "Command Generation",
        recentCommands: "Generate bash command"
      });
      
      // Clean up the response to extract just the command
      return command.trim().replace(/``````/g, '').trim();
    } catch (error) {
      console.error("Error generating bash command:", error);
      throw new Error("Failed to generate bash command");
    }
  }
  
  // Helper function to execute bash commands
  async function executeBashCommand(command) {
    const { exec } = require('child_process');
    
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(`Error: ${error.message}`);
          return;
        }
        if (stderr) {
          reject(`Error: ${stderr}`);
          return;
        }
        resolve(stdout);
      });
    });
  }
  
  // Main handler for /s commands
// Main handler for /s commands
async function handleSystemCommand(text, sender, sock) {
    const task = text.substring(2).trim();
    
    try {
      await sock.sendMessage(sender, { text: `Processing command: "${task}"...` });
      
      if (task.startsWith("screenshot") || task.includes("take screenshot")) {
        // Take a screenshot
        await sock.sendMessage(sender, { text: "Taking a screenshot of your desktop..." });
        const screenshot = await takeScreenshot();
        await sock.sendMessage(sender, { image: screenshot, caption: "Here's the screenshot of your desktop." });
      } 

      else if (task.startsWith("youtube") || task.includes("search youtube") || task.includes("find video")) {
        // Extract the search query
        let query;
        if (task.startsWith("youtube")) {
          query = task.substring(7).trim();
        } else if (task.includes("search youtube")) {
          query = task.substring(task.indexOf("search youtube") + 14).trim();
        } else if (task.includes("find video")) {
          query = task.substring(task.indexOf("find video") + 10).trim();
        }
        
        if (!query) {
          await sock.sendMessage(sender, { text: "Please specify what to search for on YouTube." });
          return true;
        }
        
        await sock.sendMessage(sender, { text: `Searching YouTube for "${query}"...` });
        
        const videos = await searchYouTube(query);
        
        if (videos.length === 0) {
          await sock.sendMessage(sender, { text: "No videos found for your query." });
          return true;
        }
        
        // Format the results
        let resultText = `Top ${videos.length} results for "${query}":\n\n`;
        videos.forEach((video, index) => {
          resultText += `${index + 1}. ${video.title}\n`;
          resultText += `   Channel: ${video.channelTitle}\n`;
          resultText += `   URL: https://www.youtube.com/watch?v=${video.videoId}\n\n`;
        });
        
        await sock.sendMessage(sender, { text: resultText });
        
        // Ask if they want to open the first video
        await sock.sendMessage(sender, { 
          text: `Would you like to open the first video? Reply with "yes" or "no".`
        });
        
        // Note: You would need to implement a way to handle the user's response here
        // This is just a placeholder for the concept
      }
      else if (task.startsWith("play") && (task.includes("video") || task.includes("youtube") || task.includes("song"))) {
        // Extract what to play
        const query = task.substring(4).trim();
        
        await sock.sendMessage(sender, { text: `Searching and opening "${query}" on YouTube...` });
        
        const result = await openYouTubeVideo(query);
        
        if (result.success) {
          await sock.sendMessage(sender, { 
            image: result.screenshot, 
            caption: `Now playing: ${result.videoInfo.title}\nChannel: ${result.videoInfo.channelTitle}\nURL: ${result.videoUrl}`
          });
        } else {
          throw new Error(result.error);
        }
      }
      
      
      else if (task.startsWith("weather") || task.includes("weather")) {
        // Extract location from command
        const locationMatch = task.match(/weather\s+(?:in|for|at)?\s+([a-zA-Z\s]+)/i);
        const location = locationMatch ? locationMatch[1].trim() : "Manipal";
        
        // Get weather information
        const weather = await getWeatherInfo(location);
        await sock.sendMessage(sender, { text: weather });
      }else if (task.startsWith("calendar")) {
        // Handle calendar commands
        const result = await handleCalendarCommand(task, sender, sock);
        await sock.sendMessage(sender, { text: result });
      }else if (task.startsWith("turn")) {
        // Handle calendar commands
        const result = await handleSystemAuthCommand(task,sender,sock);
        await sock.sendMessage(sender, { text: result });
      }
      else if (task.startsWith("open")) {
        // Extract the query (what to open)
        const query = task.substring(4).trim();
        
        // Use the new function to open and screenshot
        await sock.sendMessage(sender, { text: `Opening "${query}" and preparing screenshot...` });
        const result = await openAndScreenshot(query);
        
        if (result.success) {
          await sock.sendMessage(sender, { 
            image: result.screenshot, 
            caption: `Opened using command: ${result.command}`
          });
        } else {
          throw new Error(result.error);
        }
      } 
      else {
        // Default to bash command generation
        const bashCommand = await generateBashCommand(task);
        await sock.sendMessage(sender, { text: `Generated command: ${bashCommand}` });
        const result = await executeBashCommand(bashCommand);
        await sock.sendMessage(sender, { 
          text: `✅ Command executed successfully!\n\nCommand: ${bashCommand}\n\nOutput: ${result}` 
        });
      }
      
      return true;
    } catch (error) {
      await sock.sendMessage(sender, { 
        text: `❌ Command execution failed!\n\nError: ${error.message || error}` 
      });
      return false;
    }
  }
  

  
  
  

// Function to start the bot
async function startBot() {
  // Use the newer auth state method
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");

  // Create the socket connection
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    logger: pino({ level: "silent" }) // Set to info for more detailed logs
  });

  // Save credentials when they're updated
  sock.ev.on("creds.update", saveCreds);

  // Handle connection updates
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    
    if (connection === "close") {
      const shouldReconnect = 
        (lastDisconnect.error instanceof Boom)
          ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
          : true;
      
      console.log("Connection closed due to", lastDisconnect?.error?.message || "unknown reason");
      console.log("Reconnecting:", shouldReconnect);
      
      if (shouldReconnect) {
        startBot();
      }
    } else if (connection === "open") {
      console.log("✅ Bot is connected to WhatsApp!");
    }
  });

  // Store conversation history for context
  const conversationHistory = {};
  
// Handle incoming messages
sock.ev.on("messages.upsert", async ({ messages, type }) => {
  
    if (type === "notify") {
      for (const msg of messages) {
        if (!msg.key.fromMe && msg.message) {
          // Get the sender's JID (phone number)
          const sender = msg.key.remoteJid;
          
          // Initialize conversation history for this sender if it doesn't exist
          if (!conversationHistory[sender]) {
            conversationHistory[sender] = [];
          }
          
          // Extract the message text and media
          const messageType = Object.keys(msg.message)[0];
          let text = "";
          let mediaData = null;

          if (messageType === "audioMessage") {
            console.log(`🎤 Voice message received from ${sender}`);
            await handleVoiceMessage(msg, sock);
          }
          else if (msg.message?.documentMessage && text.startsWith('/fixcode')) {
            await handleCodeFixRequest(msg, sock);
          }
         else if (messageType === "conversation") {
            text = msg.message.conversation;
          } else if (messageType === "extendedTextMessage") {
            text = msg.message.extendedTextMessage.text;
          } else if (messageType === "imageMessage") {
            // Handle image with caption
            text = msg.message.imageMessage.caption || "Image received";
            
            try {
              // Download the image
              const buffer = await sock.downloadMediaMessage(msg);
              // Convert to base64
              mediaData = `data:${msg.message.imageMessage.mimetype};base64,${buffer.toString('base64')}`;
            } catch (err) {
              console.error("Error downloading image:", err);
            }
          } else {
            // Handle other message types if needed
            console.log("Received message of type:", messageType);
            continue;
          }
          
          if (text) {
            console.log(`📥 Message from ${sender}: ${text}`);
            
            // Send "typing" indicator to simulate AI thinking
            await sock.sendPresenceUpdate('composing', sender);
            
            try {
              // Check if this is a system command (starts with /s)
              if (text.startsWith("/s ")) {
                // Handle system command
                await handleSystemCommand(text, sender, sock);
              } else {
                // Add user message to conversation history
                conversationHistory[sender].push({ role: "user", content: text });
                
                // Keep only last 10 messages for context
                if (conversationHistory[sender].length > 10) {
                  conversationHistory[sender] = conversationHistory[sender].slice(-10);
                }
                
                // Prepare context for AI
                const context = {
                  currentDirectory: "/whatsapp/chat",
                  terminalContext: "WhatsApp Bot Environment",
                  recentCommands: conversationHistory[sender]
                    .map(msg => `${msg.role}: ${msg.content}`)
                    .join('\n'),
                  screenshot: mediaData
                };
                
                console.log("Sending request to Gemini AI with context:", { 
                  prompt: text, 
                  contextLength: context.recentCommands.length,
                  hasScreenshot: !!context.screenshot
                });
                
                // Send a "thinking" message for better UX
                if (text.length > 50) {
                  await sock.sendMessage(sender, { text: "Thinking..." });
                }
                
                // Random delay to simulate thinking (1-3 seconds)
                const thinkingTime = 1000 + Math.random() * 2000;
                await new Promise(resolve => setTimeout(resolve, thinkingTime));
                
                // Get AI response
                const aiResponse = await queryGroqAI(text, context);
                
                // Add AI response to conversation history
                conversationHistory[sender].push({ role: "assistant", content: aiResponse });
                
                // Send the AI response
                await sock.sendMessage(sender, { text: aiResponse });
              }
            } catch (error) {
              console.error("Error processing message:", error);
              await sock.sendMessage(sender, { 
                text: `Sorry, I encountered an error: ${error.message}` 
              });
            } finally {
              // Clear typing indicator
              await sock.sendPresenceUpdate('paused', sender);
            }
          }
        }
      }
    }
  });


  
}

// Start the bot with error handling
try {
  startBot();
} catch (err) {
  console.error("Error starting bot:", err);
}
