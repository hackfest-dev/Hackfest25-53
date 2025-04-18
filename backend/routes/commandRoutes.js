const express = require('express');
const router = express.Router();
const commandController = require('../controllers/commandController');

// Route to execute a command
router.post('/execute', commandController.executeCommand);

// Route to generate a command using AI
router.post('/generate', commandController.generateCommand);

// Route to open a YouTube video
router.post('/youtube', commandController.openYouTubeVideo);

module.exports = router;
