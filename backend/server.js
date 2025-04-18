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
const calendarRoutes = require('./routes/calendarRoutes');
const authRoutes = require('./routes/authRoutes'); // New auth routes

// Authentication middleware
const authController = require('./controllers/authController');

// Initialize logger
const logger = createLogger('server');

// Create Express app and server
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
  logger.info('Temporary directory created at:', tmpDir);
}

// Middleware setup
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Log all incoming requests
app.use((req, res, next) => {
  logger.info(`Incoming request: ${req.method} ${req.originalUrl}`);
  next();
});

// Health check route
app.get('/api/test', (req, res) => {
  logger.info('Test route accessed');
  res.json({ success: true, message: 'API is working' });
});

// Initialize WhatsApp service with socket.io
const botService = require('./services/whatsappService');
botService.initializeSocketIO(io);

// Register API routes
logger.info('Registering API routes...');
app.use('/api/auth', authRoutes); // Add auth routes
app.use('/api/bot', authController.verifyToken, botRoutes); // Protected by auth
app.use('/api/screenshot', authController.verifyToken, screenshotRoutes); // Protected by auth
app.use('/api/command', authController.verifyToken, commandRoutes); // Protected by auth
app.use('/api/calendar', calendarRoutes); // Calendar has its own auth handling

// Debug: Log registered routes
app._router.stack.forEach((middleware) => {
  if (middleware.route) {
    const methods = Object.keys(middleware.route.methods).join(',').toUpperCase();
    logger.info(`Route: ${methods} ${middleware.route.path}`);
  } else if (middleware.name === 'router') {
    middleware.handle.stack.forEach((handler) => {
      if (handler.route) {
        const methods = Object.keys(handler.route.methods).join(',').toUpperCase();
        logger.info(`Router: ${methods} ${handler.route.path}`);
      }
    });
  }
});

// Handle socket.io connections
io.on('connection', async (socket) => {
  logger.info(`New client connected: ${socket.id}`);

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
    logger.error('Error during socket init:', error);
    socket.emit('error', { message: 'Failed to fetch initial status' });
  }

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });

  socket.on('send-message', async ({ number, message }) => {
    try {
      const response = await botService.sendMessage(number, message);
      io.emit('message-status', response);
    } catch (error) {
      logger.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`🚀 Server is running on port ${PORT}`);
  logger.info(`🌐 API is available at http://localhost:${PORT}/api`);
});

// Handle fatal errors gracefully
process.on('uncaughtException', (error) => {
  logger.error('❗ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('❗ Unhandled Rejection at:', promise, 'reason:', reason);
});