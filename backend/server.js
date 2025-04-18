const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { createLogger } = require('./utils/logger');

// Import routes
const botRoutes = require('./routes/botRoutes');
const screenshotRoutes = require('./routes/screenshotRoutes');
const commandRoutes = require('./routes/commandRoutes');

// Initialize logger
const logger = createLogger('server');

// Create Express app
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Ensure tmp directory exists
const tmpDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Debug middleware to log all requests
app.use((req, res, next) => {
  logger.info(`Incoming request: ${req.method} ${req.url}`);
  next();
});

// Test route to check if API is alive
app.get('/api/test', (req, res) => {
  logger.info('Test route accessed');
  return res.json({ success: true, message: 'API is working' });
});

// Pass socket.io instance to bot service
const botService = require('./services/whatsappService');
botService.initializeSocketIO(io);

// IMPORTANT: Uncomment the route registrations
logger.info('Registering API routes...');
app.use('/api/bot', botRoutes);
app.use('/api/screenshot', screenshotRoutes);
app.use('/api/command', commandRoutes);

// Debug: Log registered routes
app._router.stack.forEach((middleware) => {
  if (middleware.route) {
    logger.info(`Route: ${Object.keys(middleware.route.methods).join(',')} ${middleware.route.path}`);
  } else if (middleware.name === 'router') {
    middleware.handle.stack.forEach((handler) => {
      if (handler.route) {
        const methods = Object.keys(handler.route.methods).join(',').toUpperCase();
        logger.info(`Router: ${methods} ${handler.route.path}`);
      }
    });
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  logger.info(`New client connected: ${socket.id}`);
  
  // Emit current status to the new client
  try {
    const status = botService.getStatus();
    const qr = botService.getQRCode();
    socket.emit('whatsapp-status', { 
      status: status.connected ? 'connected' : 'disconnected',
      message: status.connected ? 'Connected to WhatsApp' : 'Not connected'
    });
    
    if (qr && !status.connected) {
      socket.emit('whatsapp-qr', { qr });
    }
    
    logger.info('Sent initial status to new client');
  } catch (error) {
    logger.error('Error sending initial status:', error);
  }
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
  
  socket.on('send-message', async (data) => {
    try {
      const { number, message } = data;
      const response = await botService.sendMessage(number, message);
      io.emit('message-status', response);
    } catch (error) {
      logger.error('Error sending message:', error);
      io.emit('error', { message: error.message });
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Access the API at: http://localhost:${PORT}/api`);
});

// Error handling
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
