const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const { createLogger } = require('../utils/logger');

const logger = createLogger('gmail-service');

// Same OAuth credentials as the calendar service
const GOOGLE_CLIENT_ID = '705005017645-23mgk5cgputruevubrdab7g3qbvg9mdl.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = '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';
const GOOGLE_REDIRECT_URI = 'http://localhost:3000/api/gmail/oauth2callback';

// Gmail specific scopes
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

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
 * Generate authorization URL for Gmail
 */
async function authorize(userId) {
  // Check if we have tokens for this user
  if (userId && userTokensMap.has(userId)) {
    try {
      // Set the credentials
      const tokens = userTokensMap.get(userId);
      oauth2Client.setCredentials(tokens);
      
      // We don't need to make a real API call since we're using mock data
      // Just check if we have mock emails for this user
      if (!mockEmailsStore.has(userId)) {
        const initialEmails = generateInitialMockEmails();
        mockEmailsStore.set(userId, initialEmails);
      }
      
      // If we got here, the token is valid
      logger.info(`Using existing valid tokens for user: ${userId}`);
      return oauth2Client;
    } catch (error) {
      logger.warn(`Token validation failed for user: ${userId}, ${error.message}`);
      // Token is invalid, continue to generate new auth URL
      userTokensMap.delete(userId);
    }
  }

  // Create auth URL for new authorization
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Force consent screen to ensure we get refresh token
  });
  
  logger.info('Generated new Gmail auth URL');
  return authUrl; // Return the URL for the frontend to use
}

/**
 * Set tokens from authorization code
 */
async function setTokens(code) {
  try {
    logger.info('Getting tokens with code');
    const { tokens: newTokens } = await oauth2Client.getToken(code);
    
    // Verify we got the expected tokens
    if (!newTokens || !newTokens.access_token) {
      throw new Error('Invalid tokens received from Google');
    }
    
    logger.info('Received valid tokens');
    
    // Decode the ID token to get the user ID
    const ticket = await oauth2Client.verifyIdToken({
      idToken: newTokens.id_token,
      audience: GOOGLE_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    const userId = payload.sub;
    
    // Store tokens in the map
    userTokensMap.set(userId, newTokens);
    
    // Initialize mock emails for this user
    if (!mockEmailsStore.has(userId)) {
      const initialEmails = generateInitialMockEmails();
      mockEmailsStore.set(userId, initialEmails);
    }
    
    // Set the credentials for this request
    oauth2Client.setCredentials(newTokens);
    
    // Return the configured client
    return { oauth2Client, userId };
  } catch (error) {
    logger.error(`Error getting tokens: ${error.message}`);
    throw new Error(`Failed to authorize with Google: ${error.message}`);
  }
}

/**
 * Check if user has Gmail tokens stored
 */
async function hasTokens(userId) {
  return userTokensMap.has(userId);
}

/**
 * Helper to refresh tokens from Firebase auth
 */
async function refreshTokensFromFirebase(userId, userInfo) {
  if (!userInfo.firebase || userInfo.firebase.sign_in_provider !== 'google.com') {
    throw new Error('User is not authenticated with Google via Firebase');
  }
  
  // Create a simple token object
  const token = {
    access_token: `firebase_${userId}`, // This is a placeholder
    id_token: userInfo.firebase.identities['google.com'][0]
  };
  
  return await setGmailTokens(token, {
    sub: userId,
    email: userInfo.email,
    name: userInfo.name
  });
}

/**
 * Ensure tokens from Firebase if not already present
 */
async function ensureTokensFromFirebase(userId, userInfo) {
  if (userTokensMap.has(userId)) {
    return true;
  }
  
  if (userInfo.firebase && userInfo.firebase.sign_in_provider === 'google.com') {
    return await refreshTokensFromFirebase(userId, userInfo);
  }
  
  return false;
}

/**
 * Get emails from Gmail (or mock data)
 */
async function getEmails(userId, maxResults = 100) {
  // Check if we have tokens for this user
  if (!userId || !userTokensMap.has(userId)) {
    const authUrl = await authorize(userId);
    
    // If authorize returns a URL, it means we need user authorization
    if (typeof authUrl === 'string') {
      throw new Error('Not authorized: User has no Gmail tokens');
    }
  }

  try {
    // In a real implementation, we'd use the Gmail API here
    // For now, we'll use our mock data store
    
    // Check if we need to generate mock emails
    if (!mockEmailsStore.has(userId)) {
      const initialEmails = generateInitialMockEmails();
      mockEmailsStore.set(userId, initialEmails);
    }
    
    // Get the emails for this user
    let userEmails = mockEmailsStore.get(userId);
    
    // Add one new email to simulate receiving new mail
    // With a 20% chance (so it doesn't happen on every refresh)
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
 * Analyze email priority - this is now built into the email generation
 * but kept for API compatibility
 */
async function analyzeEmailPriority(emails) {
  // Emails already have their priority set, so just return them
  return emails;
}

module.exports = {
  setGmailTokens,
  authorize,
  setTokens,
  hasTokens,
  refreshTokensFromFirebase,
  ensureTokensFromFirebase,
  getEmails,
  analyzeEmailPriority
};
