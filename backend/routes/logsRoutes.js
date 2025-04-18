const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { verifyToken } = require('../controllers/authController');

// Route to get logs - protected by auth middleware
router.get('/', verifyToken, async (req, res) => {
  try {
    // Path to logs file - adjust if needed
    const logsPath = path.join(__dirname, '..', '..', 'scripts', 'logs', 'categorized_log.json');
    
    // Read logs file
    const logsData = await fs.readFile(logsPath, 'utf8');
    const logs = JSON.parse(logsData);
    
    res.status(200).json(logs);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch logs',
      error: error.message
    });
  }
});

module.exports = router;
