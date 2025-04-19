const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const { createLogger } = require('../utils/logger');
const aiService = require('./aiService');

const logger = createLogger('gmail-service');

// Gmail specific scopes
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

// OAuth credentials
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '705005017645-23mgk5cgputruevubrdab7g3qbvg9mdl.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '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';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/gmail/oauth2callback';

// Initialize Google OAuth client
const oauth2Client = new OAuth2Client(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

// Map to store user tokens by user ID
const userTokensMap = new Map();

/**
 * Generate authorization URL for Gmail access
 */
function getAuthUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });
}

/**
 * Set Gmail tokens from Google authentication
 */
async function setGmailTokens(googleToken, userInfo) {
  try {
    logger.info(`Setting Gmail tokens for user: ${userInfo.email || userInfo.sub}`);
    
    if (!googleToken || !googleToken.access_token) {
      logger.error(`Invalid token data for user: ${userInfo.sub}`);
      throw new Error('Invalid token data - missing access_token');
    }
    
    // Create a token object in the format OAuth2Client expects
    const tokens = {
      access_token: googleToken.access_token,
      refresh_token: googleToken.refresh_token || null,
      id_token: googleToken.id_token || googleToken.access_token,
      scope: SCOPES.join(' '),
      token_type: googleToken.token_type || 'Bearer',
      expiry_date: googleToken.expiry_date || googleToken.expires_at || (Date.now() + 3600 * 1000)
    };
    
    // Verify the token works before storing it
    try {
      // Set up a test OAuth client
      const testClient = new OAuth2Client(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI
      );
      testClient.setCredentials(tokens);
      
      // Test the token with a simple API call
      const gmail = google.gmail({ version: 'v1', auth: testClient });
      await gmail.users.getProfile({ userId: 'me' });
      
      logger.info(`Token validation successful for user: ${userInfo.sub}`);
    } catch (validationError) {
      logger.error(`Token validation failed: ${validationError.message}`);
      throw new Error(`Token validation failed: ${validationError.message}`);
    }
    
    // Store tokens in the map using user ID as key
    userTokensMap.set(userInfo.sub, tokens);
    
    // Configure the OAuth client with the tokens
    oauth2Client.setCredentials(tokens);
    
    logger.info(`Gmail access set up successfully for user: ${userInfo.email || userInfo.sub}`);
    return true;
  } catch (error) {
    logger.error(`Error setting Gmail tokens: ${error.message}`);
    throw error;
  }
}

/**
 * Exchange authorization code for tokens
 */
async function getTokensFromCode(code) {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
  } catch (error) {
    logger.error(`Error getting tokens from code: ${error.message}`);
    throw error;
  }
}

/**
 * Refresh tokens if expired
 */
async function refreshTokensIfNeeded(userId) {
  try {
    const tokens = userTokensMap.get(userId);
    
    if (!tokens) {
      logger.warn(`No tokens found for user: ${userId}`);
      return false;
    }
    
    // Check if token is expired
    if (tokens.expiry_date && tokens.expiry_date <= Date.now()) {
      logger.info(`Refreshing expired tokens for user: ${userId}`);
      
      oauth2Client.setCredentials(tokens);
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      // Update tokens in the map
      userTokensMap.set(userId, credentials);
      
      logger.info(`Tokens refreshed successfully for user: ${userId}`);
    }
    
    return true;
  } catch (error) {
    logger.error(`Error refreshing tokens: ${error.message}`);
    throw error;
  }
}

/**
 * Get emails from Gmail API
 */
async function getEmails(userId, maxResults = 30) {
  try {
    // Check if we have tokens for this user
    if (!userId || !userTokensMap.has(userId)) {
      logger.warn(`No tokens available for user: ${userId}`);
      throw new Error('User not authenticated with Gmail');
    }
    
    // Refresh tokens if needed
    try {
      await refreshTokensIfNeeded(userId);
    } catch (refreshError) {
      logger.error(`Error refreshing tokens: ${refreshError.message}`);
      // Continue anyway with existing tokens
    }
    
    // Set credentials for this specific user
    const userTokens = userTokensMap.get(userId);
    if (!userTokens || !userTokens.access_token) {
      logger.error(`Invalid tokens for user: ${userId}`);
      throw new Error('Invalid Gmail authentication tokens');
    }
    
    oauth2Client.setCredentials(userTokens);
    
    logger.info(`Fetching emails for authenticated user with ID: ${userId}`);
    
    // Create Gmail API client
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    let userEmail = '';
    
    // First, get the user's email address from Gmail profile to confirm identity
    try {
      const profile = await gmail.users.getProfile({ userId: 'me' });
      userEmail = profile.data.emailAddress;
      logger.info(`Fetching emails from: ${userEmail}`);
    } catch (profileError) {
      logger.error(`Failed to get Gmail profile: ${profileError.message}`);
      throw new Error('Gmail authentication failed: ' + profileError.message);
    }
    
    // Get list of messages - limit to the latest 30 emails
    let response;
    try {
      response = await gmail.users.messages.list({
        userId: 'me', // 'me' refers to the authenticated user whose credentials we set above
        maxResults: maxResults
      });
    } catch (listError) {
      logger.error(`Error listing messages: ${listError.message}`);
      throw new Error(`Failed to list Gmail messages: ${listError.message}`);
    }
    
    if (!response.data.messages || response.data.messages.length === 0) {
      logger.info(`No emails found for user: ${userId}`);
      return [];
    }
    
    logger.info(`Fetched ${response.data.messages.length} email IDs for user: ${userId}, getting details...`);
    
    // Get details for each message - limit to 10 at a time to avoid overloading
    const batchSize = 10;
    const emailBatches = [];
    for (let i = 0; i < response.data.messages.length; i += batchSize) {
      const batch = response.data.messages.slice(i, i + batchSize);
      emailBatches.push(batch);
    }
    
    let allEmails = [];
    for (const batch of emailBatches) {
      const batchEmails = await Promise.all(
        batch.map(async (message) => {
          try {
            const msg = await gmail.users.messages.get({
              userId: 'me', // 'me' refers to the authenticated user
              id: message.id,
              format: 'full'
            });
            
            // Parse email data
            const email = parseGmailMessage(msg.data);
            // Add user email
            email.userEmail = userEmail;
            return email;
          } catch (error) {
            logger.error(`Error fetching email ${message.id}: ${error.message}`);
            return null;
          }
        })
      );
      allEmails = [...allEmails, ...batchEmails.filter(email => email !== null)];
    }
    
    // Filter out any null values from errors
    const validEmails = allEmails.filter(email => email !== null);
    
    // Sort by date (newest first)
    validEmails.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    logger.info(`Successfully processed ${validEmails.length} emails`);
    
    // Process all emails for priority in a batch
    const analyzedEmails = await batchAnalyzeEmailPriority(validEmails);
    return analyzedEmails;
  } catch (error) {
    logger.error(`Error getting emails: ${error.message}`);
    throw error;
  }
}

/**
 * Parse Gmail message into a structured email object
 */
function parseGmailMessage(message) {
  try {
    // Extract headers
    const headers = message.payload.headers;
    const subject = headers.find(header => header.name === 'Subject')?.value || '(No Subject)';
    const from = headers.find(header => header.name === 'From')?.value || '';
    const to = headers.find(header => header.name === 'To')?.value || '';
    const date = headers.find(header => header.name === 'Date')?.value || '';
    
    // Extract body
    let body = '';
    
    if (message.payload.parts) {
      // Multipart message
      const textPart = message.payload.parts.find(part => 
        part.mimeType === 'text/plain' || part.mimeType === 'text/html'
      );
      
      if (textPart && textPart.body.data) {
        body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
      }
    } else if (message.payload.body && message.payload.body.data) {
      // Simple message
      body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
    }
    
    // Clean up HTML from body if needed
    body = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Generate direct link to this specific email in Gmail
    const emailLink = `https://mail.google.com/mail/u/0/#inbox/${message.id}`;
    
    return {
      id: message.id,
      threadId: message.threadId,
      from,
      to,
      subject,
      body: body.substring(0, 500), // Limit body size for analysis
      date: new Date(date).toISOString(),
      snippet: message.snippet,
      link: emailLink
    };
  } catch (error) {
    logger.error(`Error parsing Gmail message: ${error.message}`);
    throw error;
  }
}

/**
 * Batch analyze multiple emails for priority using Groq AI
 */
async function batchAnalyzeEmailPriority(emails) {
  try {
    if (emails.length === 0) return [];
    
    logger.info(`Analyzing priorities for ${emails.length} emails`);
    
    // Prepare content for batch analysis
    const emailsForAnalysis = emails.map(email => ({
      id: email.id,
      from: email.from,
      subject: email.subject,
      snippet: email.snippet
    }));
    
    try {
      // Create prompt for Groq to analyze all emails at once
      const prompt = `
        Analyze the following list of ${emails.length} emails and determine for EACH email:
        1. Priority level (high, medium, or low)
        2. For high priority emails only, provide a brief reason (max 50 characters)
        3. Category or type of email (e.g., work, personal, notification, etc.)
        
        Respond with VALID JSON ONLY in this exact format:
        {
          "results": [
            {
              "id": "email_id_1",
              "priority": "high|medium|low",
              "priorityReason": "brief reason for high priority emails only",
              "category": "category"
            },
            ...more emails...
          ]
        }
        
        Emails to analyze:
        ${JSON.stringify(emailsForAnalysis, null, 2)}
        
        Guidelines for priority assignment:
        - High: urgent requests, important meetings, critical issues, emails from executives/bosses
        - Medium: normal work communications, requests with reasonable deadlines, updates
        - Low: newsletters, marketing, non-urgent FYIs, automated notifications
      `;
      
      // Call Groq AI to analyze all emails at once - WITH TIMEOUT
      const aiPromise = aiService.queryGroqAI(prompt, {
        currentDirectory: process.cwd(),
        terminalContext: "email batch analysis"
      });
      
      // Set a timeout for AI analysis to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("AI analysis timeout")), 10000);
      });
      
      // Race between the AI analysis and timeout
      const aiResponse = await Promise.race([aiPromise, timeoutPromise]);
      
      // Parse the AI response
      let aiResults;
      try {
        // Extract JSON from the response (in case there's extra text)
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiResults = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("No JSON found in response");
        }
      } catch (jsonError) {
        logger.error(`Error parsing AI batch response: ${jsonError.message}`);
        logger.debug(`AI Response was: ${aiResponse}`);
        throw jsonError;
      }
      
      // Merge AI analysis with original emails
      return emails.map(email => {
        const analysis = aiResults.results.find(result => result.id === email.id) || {
          priority: 'medium',
          priorityReason: '',
          category: 'uncategorized'
        };
        
        return {
          ...email,
          priority: analysis.priority || 'medium',
          priorityReason: analysis.priorityReason || '',
          category: analysis.category || 'uncategorized'
        };
      });
    } catch (aiError) {
      // If AI analysis fails, log it but don't fail the whole request
      logger.error(`AI analysis failed: ${aiError.message}. Using default priorities.`);
      
      // Return emails with default priority settings
      return emails.map(email => ({
        ...email,
        priority: determineBasicPriority(email),
        priorityReason: 'Auto-assigned (AI unavailable)',
        category: guessCategory(email)
      }));
    }
  } catch (error) {
    logger.error(`Error in batch email analysis: ${error.message}`);
    
    // Return original emails with default priority
    return emails.map(email => ({
      ...email,
      priority: 'medium',
      priorityReason: 'Default priority (analysis error)',
      category: 'uncategorized'
    }));
  }
}

/**
 * Basic priority determination without AI
 */
function determineBasicPriority(email) {
  // Check for indicators of high priority
  const highPriorityTerms = ['urgent', 'asap', 'emergency', 'immediately', 'deadline', 'important'];
  const subject = email.subject.toLowerCase();
  const snippet = email.snippet?.toLowerCase() || '';
  
  // Check subject for high priority terms
  if (highPriorityTerms.some(term => subject.includes(term))) {
    return 'high';
  }
  
  // Check for common newsletter or notification patterns
  const lowPriorityPatterns = [
    'newsletter', 'update', 'digest', 'no-reply', 'noreply', 'notification',
    'subscription', 'unsubscribe', 'weekly', 'monthly'
  ];
  
  if (lowPriorityPatterns.some(term => 
    email.from.toLowerCase().includes(term) || 
    subject.includes(term))
  ) {
    return 'low';
  }
  
  // Default to medium priority
  return 'medium';
}

/**
 * Basic category guessing without AI
 */
function guessCategory(email) {
  const from = email.from.toLowerCase();
  const subject = email.subject.toLowerCase();
  
  // Guess based on common patterns
  if (from.includes('linkedin') || subject.includes('linkedin')) {
    return 'social';
  } else if (from.includes('github') || subject.includes('github')) {
    return 'development';
  } else if (from.includes('amazon') || from.includes('order') || 
             subject.includes('order') || subject.includes('shipment')) {
    return 'shopping';
  } else if (from.includes('calendar') || subject.includes('meeting') || 
             subject.includes('appointment') || subject.includes('schedule')) {
    return 'calendar';
  } else if (from.includes('@slack.com') || subject.includes('slack')) {
    return 'work';
  }
  
  return 'uncategorized';
}

/**
 * Analyze a single email priority - wrapper around batchAnalyzeEmailPriority for backward compatibility
 */
async function analyzeEmailPriority(email) {
  try {
    logger.info(`Analyzing priority for single email: ${email.id}`);
    
    // Use our batch function with an array of one email
    const analyzedEmails = await batchAnalyzeEmailPriority([email]);
    
    // Return the first (and only) email from the result
    return analyzedEmails[0] || {
      ...email,
      priority: 'medium',
      priorityReason: 'Default priority (single email analysis)',
      category: 'uncategorized'
    };
  } catch (error) {
    logger.error(`Error in single email analysis: ${error.message}`);
    
    // Return original email with default priority
    return {
      ...email,
      priority: 'medium',
      priorityReason: 'Default priority (analysis error)',
      category: 'uncategorized'
    };
  }
}

/**
 * Check if user has Gmail tokens stored
 */
function hasTokens(userId) {
  return userTokensMap.has(userId);
}

/**
 * Refresh tokens from Firebase
 */
async function refreshTokensFromFirebase(userId, firebaseTokens) {
  try {
    if (!userId || !firebaseTokens) {
      logger.warn('Missing userId or tokens for refreshing from Firebase');
      return false;
    }
    
    logger.info(`Refreshing tokens from Firebase for user: ${userId}`);
    
    // Update tokens in the map
    userTokensMap.set(userId, firebaseTokens);
    
    return true;
  } catch (error) {
    logger.error(`Error refreshing tokens from Firebase: ${error.message}`);
    throw error;
  }
}

/**
 * Ensure tokens are loaded from Firebase
 */
async function ensureTokensFromFirebase(userId, userObj) {
  try {
    if (!userId) {
      logger.warn('Missing userId for ensuring tokens from Firebase');
      return false;
    }
    
    // If we already have tokens, we're good
    if (userTokensMap.has(userId)) {
      // But verify they still work
      try {
        // Set up a test client with the stored tokens
        const testClient = new OAuth2Client(
          GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET,
          GOOGLE_REDIRECT_URI
        );
        testClient.setCredentials(userTokensMap.get(userId));
        
        // Test the token
        const gmail = google.gmail({ version: 'v1', auth: testClient });
        await gmail.users.getProfile({ userId: 'me' });
        
        logger.info(`Tokens still valid for user: ${userId}`);
        return true;
      } catch (validationError) {
        logger.warn(`Stored tokens no longer valid: ${validationError.message}`);
        // Continue to extract new tokens
        userTokensMap.delete(userId);
      }
    }
    
    logger.info(`Attempting to extract tokens from Firebase user object for: ${userId}`);
    
    // Check if we have a valid user object
    if (!userObj) {
      logger.warn(`No user object provided for user: ${userId}`);
      return false;
    }
    
    // Extract user info from various possible locations in the Firebase user object
    const extractAccessToken = () => {
      // Try different possible locations where the token might be
      if (userObj.stsTokenManager?.accessToken) {
        return userObj.stsTokenManager.accessToken;
      } else if (userObj.firebase?.stsTokenManager?.accessToken) {
        return userObj.firebase.stsTokenManager.accessToken;
      } else if (userObj.auth?.accessToken) {
        return userObj.auth.accessToken;
      } else if (userObj.accessToken) {
        return userObj.accessToken;
      } else if (userObj.providerData?.[0]?.accessToken) {
        return userObj.providerData[0].accessToken;
      }
      return null;
    };
    
    const extractRefreshToken = () => {
      if (userObj.stsTokenManager?.refreshToken) {
        return userObj.stsTokenManager.refreshToken;
      } else if (userObj.firebase?.stsTokenManager?.refreshToken) {
        return userObj.firebase.stsTokenManager.refreshToken;
      } else if (userObj.refreshToken) {
        return userObj.refreshToken;
      }
      return null;
    };
    
    // Try to extract tokens
    const accessToken = extractAccessToken();
    const refreshToken = extractRefreshToken();
    const idToken = userObj.idToken || userObj.stsTokenManager?.accessToken || userObj.firebase?.stsTokenManager?.accessToken;
    
    // Log what we found for debugging
    logger.debug(`Firebase token extraction results for ${userId}: ` + 
      `accessToken=${!!accessToken}, refreshToken=${!!refreshToken}, idToken=${!!idToken}`);
    
    if (accessToken) {
      // We have at least an access token, create a token object
      const firebaseTokens = {
        access_token: accessToken,
        refresh_token: refreshToken || null,
        id_token: idToken || accessToken,
        token_type: 'Bearer',
        expiry_date: userObj.stsTokenManager?.expirationTime || 
                    userObj.firebase?.stsTokenManager?.expirationTime || 
                    (Date.now() + 3600 * 1000)
      };
      
      logger.info(`Found Firebase tokens for user: ${userId}`);
      userTokensMap.set(userId, firebaseTokens);
      return true;
    } else {
      logger.warn(`No valid tokens found in Firebase user object for: ${userId}`);
    }
    
    // If we get here, we couldn't extract tokens
    return false;
  } catch (error) {
    logger.error(`Error ensuring tokens from Firebase: ${error.message}`);
    logger.debug(`Error stack: ${error.stack}`);
    return false;
  }
}

module.exports = {
  getAuthUrl,
  setGmailTokens,
  getTokensFromCode,
  refreshTokensIfNeeded,
  getEmails,
  batchAnalyzeEmailPriority,
  analyzeEmailPriority, // Now properly defined
  hasTokens,
  refreshTokensFromFirebase,
  ensureTokensFromFirebase,
  
  // For backward compatibility and API consistency
  authorize: getAuthUrl,
  setTokens: getTokensFromCode
};