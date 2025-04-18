const express = require('express');
const router = express.Router();
const screenshotController = require('../controllers/screenshotController');

// Route to take a screenshot
router.get('/', screenshotController.takeScreenshot);

// Route to save a browser-based screenshot
router.post('/browser-screenshot', screenshotController.saveBrowserScreenshot);

// Route to get a specific screenshot
router.get('/:filename', screenshotController.getScreenshot);

module.exports = router;
