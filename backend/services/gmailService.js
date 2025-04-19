const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const { createLogger } = require('../utils/logger');

const logger = createLogger('gmail-service');

// Gmail specific scopes
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

// Same OAuth credentials as the calendar service for consistency
const GOOGLE_CLIENT_ID = '705005017645-23mgk5cgputruevubrdab7g3qbvg9mdl.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = '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';
const GOOGLE_REDIRECT_URI = 'http://localhost:3000/api/gmail/oauth2callback';

// Initialize Google OAuth client
const oauth2Client = new OAuth2Client(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

// Map to store user tokens by user ID
const userTokensMap = new Map();

// Store mock emails in memory for consistency between requests
// We'll make this a map of userId -> emails array for multi-user support
const mockEmailsStore = new Map();

// Keywords that indicate high priority
const HIGH_PRIORITY_KEYWORDS = [
  'urgent', 'important', 'immediately', 'asap', 'deadline', 
  'critical', 'required', 'action needed', 'attention'
];

// Keywords that indicate medium priority
const MEDIUM_PRIORITY_KEYWORDS = [
  'request', 'update', 'review', 'please', 'meeting', 
  'schedule', 'follow up', 'reminder'
];

/**
 * Set Gmail tokens from Google authentication
 */
async function setGmailTokens(googleToken, userInfo) {
  try {
    logger.info(`Setting Gmail tokens for user: ${userInfo.email}`);
    
    // Create a token object in the format OAuth2Client expects
    const tokens = {
      access_token: googleToken.access_token,
      id_token: googleToken.id_token,
      scope: SCOPES.join(' '),
      token_type: 'Bearer'
    };
    
    // Store tokens in the map using user ID as key
    userTokensMap.set(userInfo.sub, tokens);
    
    // Configure the OAuth client with the tokens
    oauth2Client.setCredentials(tokens);
    
    // Initialize mock emails for this user if they don't exist yet
    if (!mockEmailsStore.has(userInfo.sub)) {
      const initialEmails = generateInitialMockEmails();
      mockEmailsStore.set(userInfo.sub, initialEmails);
    }
    
    logger.info(`Gmail access set up successfully for user: ${userInfo.email}`);
    return true;
  } catch (error) {
    logger.error(`Error setting Gmail tokens: ${error.message}`);
    throw error;
  }
}

/**
 * Get emails from Gmail (or mock data)
 */
async function getEmails(userId, maxResults = 100) {
  try {
    // Check if we have tokens for this user
    if (!userId || !userTokensMap.has(userId)) {
      logger.warn(`No tokens available for user: ${userId}`);
      
      // Initialize mock emails anyway for testing
      if (!mockEmailsStore.has(userId)) {
        const initialEmails = generateInitialMockEmails();
        mockEmailsStore.set(userId, initialEmails);
        logger.info(`Created mock emails for user ${userId}`);
      }
    }

    // Get the emails for this user (or create mock data if needed)
    if (!mockEmailsStore.has(userId)) {
      const initialEmails = generateInitialMockEmails();
      mockEmailsStore.set(userId, initialEmails);
    }
    
    // Get the emails for this user
    let userEmails = mockEmailsStore.get(userId);
    
    // Add one new email to simulate receiving new mail with a 20% chance
    if (Math.random() < 0.2) {
      const newEmail = generateNewEmail();
      userEmails.unshift(newEmail); // Add to the beginning (newest first)
      
      // Keep the list at a reasonable size
      if (userEmails.length > 500) {
        userEmails = userEmails.slice(0, 500);
      }
      
      // Update the store
      mockEmailsStore.set(userId, userEmails);
      logger.info(`Added new email for user ${userId}: ${newEmail.subject}`);
    }
    
    // Sort by date (newest first) to ensure consistent order
    userEmails.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Return the requested number of emails
    return userEmails.slice(0, maxResults);
  } catch (error) {
    logger.error(`Error getting emails: ${error.message}`);
    throw error;
  }
}

/**
 * Check if user has Gmail tokens stored
 */
function hasTokens(userId) {
  return userTokensMap.has(userId);
}

// Helper functions for generating mock emails

/**
 * Generate consistent initial mock emails
 */
function generateInitialMockEmails(count = 100) {
  const senders = [
    'John Smith <john.smith@example.com>',
    'Emily Johnson <emily.johnson@example.com>',
    'Michael Williams <michael.w@example.com>',
    'Sarah Jones <sarah.jones@example.com>',
    'David Brown <david.brown@example.com>',
    'Team Updates <updates@company.com>',
    'Project Notifications <projects@company.com>',
    'IT Support <support@company.com>',
    'HR Department <hr@company.com>',
    'Finance <finance@company.com>'
  ];
  
  const subjects = [
    'Team Meeting Tomorrow',
    'Project Update: Phase 2 Complete',
    'URGENT: Server Maintenance Tonight',
    'Weekly Report - Please Review',
    'Reminder: Deadline Approaching',
    'Office Closure Notice',
    'Training Session Next Week',
    'Important: Policy Updates',
    'Action Required: Document Approval',
    'Invitation to Company Event',
    'Your Feedback Requested',
    'System Upgrade Completed',
    'New Feature Announcement',
    'Holiday Schedule Update',
    'Quarterly Review Summary'
  ];
  
  const bodies = [
    'Please find attached the agenda for our meeting tomorrow.',
    'I wanted to inform you that we have completed Phase 2 of the project.',
    'The server will be down for maintenance tonight from 10 PM to 2 AM.',
    'Attached is the weekly report. Please review and provide feedback.',
    'This is a reminder that the project deadline is approaching.',
    'The office will be closed on Monday for the holiday.',
    'A training session has been scheduled for next Wednesday at 2 PM.',
    'There have been important updates to the company policy.',
    'Please review and approve the attached document by Friday.',
    'You are invited to the company event next month.',
    'We would appreciate your feedback on the recent changes.',
    'The system upgrade has been completed successfully.',
    'We are excited to announce a new feature in our product.',
    'Please note the updated holiday schedule for this year.',
    'Here is a summary of our quarterly review meeting.'
  ];
  
  const emails = [];
  
  // Generate emails with timestamps spread over the last month
  for (let i = 0; i < count; i++) {
    const date = new Date();
    // Distribute emails over the past 30 days, with more recent ones being more common
    const daysAgo = Math.floor(Math.pow(Math.random(), 2) * 30); // Bias towards recent emails
    date.setDate(date.getDate() - daysAgo);
    // Add random hours/minutes
    date.setHours(Math.floor(Math.random() * 24));
    date.setMinutes(Math.floor(Math.random() * 60));
    
    // Pick sender and subject
    const from = senders[Math.floor(Math.random() * senders.length)];
    const subjectIndex = Math.floor(Math.random() * subjects.length);
    const subject = subjects[subjectIndex];
    const body = bodies[subjectIndex];
    
    // Deterministic priority based on subject content
    let priority = determinePriority(subject, body);
    
    emails.push({
      id: `email-${date.getTime()}-${i}`,
      from,
      subject,
      body,
      date: date.toISOString(),
      priority,
      priorityReason: getPriorityReason(priority, subject, body),
      link: 'https://mail.google.com'
    });
  }
  
  // Sort by date, newest first
  emails.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  return emails;
}

/**
 * Generate a new email to simulate receiving new mail
 */
function generateNewEmail() {
  const senders = [
    'John Smith <john.smith@example.com>',
    'Emily Johnson <emily.johnson@example.com>',
    'Michael Williams <michael.w@example.com>',
    'Sarah Jones <sarah.jones@example.com>',
    'David Brown <david.brown@example.com>'
  ];
  
  const subjects = [
    'New Message: Follow-up from today',
    'URGENT: Action required ASAP',
    'Meeting rescheduled to tomorrow',
    'Update on current project',
    'Request for your input',
    'Important information - please read'
  ];
  
  const bodies = [
    'I wanted to follow up on our conversation from today.',
    'We need your immediate action on this matter. Please respond ASAP.',
    'The meeting has been rescheduled to tomorrow at 2 PM.',
    'Here is an update on the current project status.',
    'I would appreciate your input on this matter.',
    'Please read this important information regarding the upcoming changes.'
  ];
  
  // Generate a timestamp within the last hour
  const date = new Date();
  date.setMinutes(date.getMinutes() - Math.floor(Math.random() * 60));
  
  // Pick sender and subject
  const from = senders[Math.floor(Math.random() * senders.length)];
  const subjectIndex = Math.floor(Math.random() * subjects.length);
  const subject = subjects[subjectIndex];
  const body = bodies[subjectIndex];
  
  // Determine priority based on subject content
  let priority = determinePriority(subject, body);
  
  return {
    id: `email-${date.getTime()}-new`,
    from,
    subject,
    body,
    date: date.toISOString(),
    priority,
    priorityReason: getPriorityReason(priority, subject, body),
    link: 'https://mail.google.com'
  };
}

/**
 * Determine priority based on email content (consistent algorithm)
 */
function determinePriority(subject, body) {
  const combinedText = (subject + ' ' + body).toLowerCase();
  
  // Check for high priority keywords
  for (const keyword of HIGH_PRIORITY_KEYWORDS) {
    if (combinedText.includes(keyword.toLowerCase())) {
      return 'high';
    }
  }
  
  // Check for medium priority keywords
  for (const keyword of MEDIUM_PRIORITY_KEYWORDS) {
    if (combinedText.includes(keyword.toLowerCase())) {
      return 'medium';
    }
  }
  
  // Default to low priority
  return 'low';
}

/**
 * Get reason for assigned priority
 */
function getPriorityReason(priority, subject, body) {
  if (priority === 'high') {
    // Find which high priority keyword matched
    const combinedText = (subject + ' ' + body).toLowerCase();
    for (const keyword of HIGH_PRIORITY_KEYWORDS) {
      if (combinedText.includes(keyword.toLowerCase())) {
        return `Contains "${keyword}" which indicates high priority`;
      }
    }
    return 'Marked as high priority based on content analysis';
  }
  
  return '';
}

/**
 * Analyze email priority - for API compatibility
 */
async function analyzeEmailPriority(emails) {
  return emails;
}

module.exports = {
  setGmailTokens,
  authorize: async (userId) => {
    // For simplicity, just return a mock auth URL
    logger.info(`Authorize called for user: ${userId}`);
    return "https://accounts.google.com/o/oauth2/auth?mock=true";
  },
  setTokens: async (code) => {
    // Mock implementation to avoid errors
    logger.info(`SetTokens called with code: ${code}`);
    return { success: true };
  },
  hasTokens,
  refreshTokensFromFirebase: async (userId) => {
    logger.info(`RefreshTokensFromFirebase called for user: ${userId}`);
    // Mock implementation
    return true;
  },
  ensureTokensFromFirebase: async (userId) => {
    logger.info(`EnsureTokensFromFirebase called for user: ${userId}`);
    // Mock implementation
    return true;
  },
  getEmails,
  analyzeEmailPriority
};
