const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const fs = require('fs').promises;
const path = require('path');
const pino = require('pino');
const { createLogger } = require('../utils/logger');
const config = require('../config/config');
const aiService = require('./aiService');

const logger = createLogger('whatsapp-service');
let sock = null;
let io = null;
let qrCode = null;
let isConnected = false;
const conversationHistory = {};

// Function to initialize socket.io for real-time updates
function initializeSocketIO(socketIO) {
  io = socketIO;
  // If we already have a QR code when socket connects, send it immediately
  if (qrCode && io) {
    io.emit('whatsapp-qr', { qr: qrCode });
    logger.info('Sent existing QR code to newly connected client');
  }
}

// Function to start the WhatsApp bot
async function startBot() {
  try {
    logger.info('Starting WhatsApp bot...');
    
    // Clear any existing QR code
    qrCode = null;
    isConnected = false;
    
    const authFolder = path.join(__dirname, '..', config.whatsapp.authFolder);
    logger.info(`Using auth folder: ${authFolder}`);
    
    // Ensure auth folder exists
    try {
      await fs.mkdir(authFolder, { recursive: true });
    } catch (error) {
      logger.error(`Error creating auth folder: ${error.message}`);
    }
    
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    // Create the socket connection with configuration similar to bot.cjs
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      logger: pino({ level: "silent" }), // Simplified logging
      browser: ['Axentis Bot', 'Chrome', '10.0.0'],
      syncFullHistory: false // Don't sync full history for faster login
    });

    // Save credentials when they're updated
    sock.ev.on("creds.update", saveCreds);

    // Handle connection updates with more detailed logging
    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      logger.info(`Connection update: ${JSON.stringify(update, (key, value) => {
        // Don't log the full QR code string in logs
        if (key === 'qr' && value) return 'QR code received (hidden)';
        return value;
      })}`);
      
      if (qr) {
        logger.info('New QR code generated!');
        qrCode = qr;
        
        // Send QR code to frontend via socket.io
        if (io) {
          logger.info('Emitting QR code to frontend');
          io.emit('whatsapp-qr', { qr });
        }
      }
      
      if (connection === "close") {
        const shouldReconnect = 
          (lastDisconnect.error instanceof Boom)
            ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
            : true;
        
        logger.info("Connection closed due to", lastDisconnect?.error?.message || "unknown reason");
        logger.info("Reconnecting:", shouldReconnect);
        isConnected = false;
        
        if (io) {
          io.emit('whatsapp-status', { 
            status: 'disconnected', 
            message: lastDisconnect?.error?.message || "Connection closed" 
          });
        }
        
        if (shouldReconnect) {
          startBot();
        }
      } else if (connection === "open") {
        logger.info("✅ Bot is connected to WhatsApp!");
        isConnected = true;
        
        if (io) {
          io.emit('whatsapp-status', { 
            status: 'connected', 
            message: "Connected to WhatsApp" 
          });
        }
      }
    });

    // Handle incoming messages
    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type === "notify") {
        for (const msg of messages) {
          if (!msg.key.fromMe && msg.message) {
            // Process the message
            await processIncomingMessage(msg);
          }
        }
      }
    });

    return sock;
  } catch (error) {
    logger.error("Error starting WhatsApp bot:", error);
    throw error;
  }
}

// New function to logout and clear auth
async function logout() {
  logger.info('Logging out WhatsApp session...');
  
  try {
    // Clear the existing WhatsApp session
    const authFolder = path.join(__dirname, '..', config.whatsapp.authFolder);
    
    // List all files in the auth folder
    const files = await fs.readdir(authFolder);
    logger.info(`Found ${files.length} auth files to remove`);
    
    // Delete each file
    for (const file of files) {
      const filePath = path.join(authFolder, file);
      await fs.unlink(filePath);
      logger.info(`Deleted auth file: ${file}`);
    }
    
    // Reset connection state
    isConnected = false;
    qrCode = null;
    
    // Notify clients of logout immediately
    if (io) {
      logger.info('Emitting disconnected status to all clients');
      io.emit('whatsapp-status', { 
        status: 'disconnected',
        connected: false,
        message: "Logged out manually"
      });
    }
    
    // Restart the bot to generate new QR code
    if (sock) {
      // Try to properly close any existing connection
      try {
        sock.ev?.removeAllListeners(); // Clean up all listeners
        sock.logout().catch(e => logger.warn('Logout error (expected):', e.message));
      } catch (err) {
        logger.warn('Error during socket cleanup:', err.message);
      }
    }
    
    sock = null;
    
    // Start the bot again to generate a new QR code
    logger.info('Starting bot to generate new QR code');
    setTimeout(async () => {
      await startBot();
      logger.info('Bot restarted after logout, QR should be generated shortly');
    }, 1000);
    
    return { success: true, message: 'Logged out successfully' };
  } catch (error) {
    logger.error('Error during logout:', error);
    return { success: false, error: error.message };
  }
}

// Function to process incoming messages
async function processIncomingMessage(msg) {
  try {
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
      logger.info(`Voice message received from ${sender}`);
      await handleVoiceMessage(msg, sock);
    } else if (messageType === "conversation") {
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
        logger.error("Error downloading image:", err);
      }
    }
    
    if (text) {
      logger.info(`Message from ${sender}: ${text}`);
      
      // Send "typing" indicator to simulate thinking
      await sock.sendPresenceUpdate('composing', sender);
      
      try {
        // Check message type and process accordingly
        if (text.startsWith("/chat ")) {
          // CHAT MODE: AI conversation for messages starting with /chat
          const chatPrompt = text.substring(6).trim();
          await handleAIChatMode(chatPrompt, sender, sock, mediaData);
        } else if (text.startsWith("/s ")) {
          // For backward compatibility - keep /s command handler
          await handleSystemCommand(text, sender, sock);
        } else {
          // DEFAULT MODE: Process all other messages as PC control commands
          await handleCommandMode(text, sender, sock);
        }
      } catch (error) {
        logger.error("Error processing message:", error);
        await sock.sendMessage(sender, { 
          text: `❌ Error: ${error.message}` 
        });
      } finally {
        // Clear typing indicator
        await sock.sendPresenceUpdate('paused', sender);
      }
    }
  } catch (error) {
    logger.error("Error processing message:", error);
    
    // Notify the sender about the error
    try {
      if (sock && msg.key.remoteJid) {
        await sock.sendMessage(msg.key.remoteJid, { 
          text: `Sorry, I encountered an error: ${error.message}` 
        });
        await sock.sendPresenceUpdate('paused', msg.key.remoteJid);
      }
    } catch (sendError) {
      logger.error("Error sending error notification:", sendError);
    }
  }
}

// New function to handle command mode (default mode)
async function handleCommandMode(text, sender, sock) {
  await sock.sendMessage(sender, { text: `Processing your command: "${text}"...` });
  
  // Use the command service to process the text
  const commandService = require('./commandService');
  const result = await commandService.processTextCommand(text);
  
  // Send back the command and output
  await sock.sendMessage(sender, { 
    text: `✅ Command executed:\n\n${result.command}\n\nOutput: ${
      result.output.length > 500 ? result.output.substring(0, 500) + '...' : result.output
    }`
  });
  
  // Send screenshot back to WhatsApp
  await sock.sendMessage(sender, {
    image: result.screenshot,
    caption: `Screenshot after executing: ${result.command}`
  });
  
  // Add to conversation history
  conversationHistory[sender].push({ 
    role: "user", 
    content: text 
  });
  conversationHistory[sender].push({ 
    role: "assistant", 
    content: `Executed command: ${result.command}` 
  });
}

// Add new function for AI chat mode
async function handleAIChatMode(text, sender, sock, mediaData) {
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
  
  // Send a "thinking" message for better UX
  if (text.length > 50) {
    await sock.sendMessage(sender, { text: "Thinking..." });
  }
  
  // Random delay to simulate thinking (1-3 seconds)
  const thinkingTime = 1000 + Math.random() * 2000;
  await new Promise(resolve => setTimeout(resolve, thinkingTime));
  
  // Get AI response
  const aiResponse = await aiService.queryGroqAI(text, context);
  
  // Add AI response to conversation history
  conversationHistory[sender].push({ role: "assistant", content: aiResponse });
  
  // Send the AI response
  await sock.sendMessage(sender, { text: aiResponse });
  
  // Emit message to frontend via socket.io
  if (io) {
    io.emit('whatsapp-message', {
      sender,
      message: text,
      response: aiResponse,
      timestamp: new Date()
    });
  }
}

// Handle voice messages
async function handleVoiceMessage(msg, sock) {
  const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
  const sender = msg.key.remoteJid;
  
  try {
    if (!msg.message?.audioMessage) throw new Error("Not a voice message");
    
    // Show recording indicator when processing starts
    await sock.sendPresenceUpdate('recording', sender);
    
    // Download audio
    const stream = await downloadContentFromMessage(msg.message.audioMessage, 'audio');
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }

    // Transcribe using Whisper
    const transcription = await aiService.transcribeAudio(buffer);
    logger.info('Transcription:', transcription);

    // Process with AI
    const aiResponse = await aiService.queryGroqAI(transcription);
    const responseAudio = await aiService.textToSpeech(aiResponse);

    // Send voice response
    await sock.sendMessage(sender, {
      audio: responseAudio,
      mimetype: 'audio/mpeg',
      ptt: true
    });

    // Hide recording indicator after successful response
    await sock.sendPresenceUpdate('paused', sender);
    
    // Emit to frontend
    if (io) {
      io.emit('whatsapp-voice', {
        sender,
        transcription,
        response: aiResponse,
        timestamp: new Date()
      });
    }

  } catch (error) {
    logger.error("Voice message error:", error);
    // Ensure indicator is cleared on error
    await sock.sendPresenceUpdate('paused', sender);
    await sock.sendMessage(sender, { 
      text: `❌ Error: ${error.message}` 
    });
  }
}

// Function to send a message from the API
async function sendMessage(number, message) {
  try {
    if (!sock || !isConnected) {
      throw new Error('WhatsApp bot is not connected');
    }
    
    // Format number for WhatsApp
    const formattedNumber = `${number}@s.whatsapp.net`;
    
    // Send message
    const result = await sock.sendMessage(formattedNumber, { text: message });
    
    logger.info(`Message sent to ${number}`);
    
    return {
      success: true,
      recipient: number,
      message,
      messageId: result.key.id
    };
  } catch (error) {
    logger.error(`Error sending message to ${number}:`, error);
    throw error;
  }
}

// Get the current QR code
function getQRCode() {
  logger.info(`Getting QR code, current value: ${qrCode ? 'exists' : 'null'}`);
  return qrCode; // Return directly, not wrapped in an object
}

// Get connection status
function getStatus() {
  return {
    connected: isConnected
  };
}

// Main handler for /s commands
async function handleSystemCommand(text, sender, sock) {
  const task = text.substring(2).trim();
  const commandService = require('./commandService');
  const screenshotService = require('./screenshotService');
  
  try {
    await sock.sendMessage(sender, { text: `Processing command: "${task}"...` });
    
    if (task.startsWith("screenshot") || task.includes("take screenshot")) {
      // Take a screenshot
      await sock.sendMessage(sender, { text: "Taking a screenshot of your desktop..." });
      const screenshot = screenshotService.takeScreenshot();
      await sock.sendMessage(sender, { 
        image: screenshot.buffer, 
        caption: "Here's the screenshot of your desktop." 
      });
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
      
      const videos = await aiService.searchYouTube(query);
      
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
    }
    else if (task.startsWith("play") && (task.includes("video") || task.includes("youtube") || task.includes("song"))) {
      // Extract what to play
      const query = task.substring(4).trim();
      
      await sock.sendMessage(sender, { text: `Searching and opening "${query}" on YouTube...` });
      
      const result = await commandService.openYouTubeVideo(query);
      
      if (result.success) {
        await sock.sendMessage(sender, { 
          image: result.screenshot, 
          caption: `Now playing: ${result.videoInfo.title}\nChannel: ${result.videoInfo.channelTitle}\nURL: ${result.videoUrl}`
        });
      } else {
        throw new Error(result.error);
      }
    }
    else {
      // Default to bash command generation
      const commandResult = await commandService.generateCommand(task);
      await sock.sendMessage(sender, { text: `Generated command: ${commandResult.command}` });
      
      const execResult = await commandService.executeCommand(commandResult.command);
      await sock.sendMessage(sender, { 
        text: `✅ Command executed successfully!\n\nCommand: ${commandResult.command}\n\nOutput: ${execResult.output.substring(0, 1000)}` 
      });
    }
    
    return true;
  } catch (error) {
    logger.error("System command error:", error);
    await sock.sendMessage(sender, { 
      text: `❌ Command execution failed!\n\nError: ${error.message || error}` 
    });
    return false;
  }
}

// Start the bot when module is loaded
const botInstance = startBot();

module.exports = {
  startBot,
  sendMessage,
  getQRCode,
  getStatus,
  initializeSocketIO,
  logout // Export the new logout function
};
