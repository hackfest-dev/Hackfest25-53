const { google } = require('googleapis');
const { addMinutes, parseISO, format } = require('date-fns');
const { Groq } = require('groq-sdk');
const { OAuth2Client } = require('google-auth-library');
const path = require('path');

// Configuration
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const CALENDAR_ID = 'primary'; // Use 'primary' for the primary calendar
const GROQ_API_KEY = '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';

// Hardcoded Google OAuth credentials
const GOOGLE_CLIENT_ID = '705005017645-23mgk5cgputruevubrdab7g3qbvg9mdl.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = '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';
// Updated redirect URI to match the actual frontend route
const GOOGLE_REDIRECT_URI = 'http://localhost:3000/api/calendar/oauth2callback';

// Initialize Groq client
const groq = new Groq({
  apiKey: GROQ_API_KEY
});

// Initialize Google OAuth client
const oauth2Client = new OAuth2Client(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

// Map to store user tokens by user ID
const userTokensMap = new Map();

// New method to set tokens directly from Firebase authentication
async function setGoogleTokens(googleToken, userInfo) {
  try {
    console.log('Setting Google tokens for user:', userInfo.email);
    
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
    
    // Verify access to calendar by making a simple API call
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    await calendar.calendarList.list({ maxResults: 1 });
    
    console.log('Calendar access verified successfully for user:', userInfo.email);
    return true;
  } catch (error) {
    console.error('Error setting Google tokens:', error);
    throw new Error(`Failed to set Google tokens: ${error.message}`);
  }
}

// Updated authorize function to better handle token state
async function authorize(userId) {
  // Check if we have tokens for this user
  if (userId && userTokensMap.has(userId)) {
    try {
      // Set the credentials
      const tokens = userTokensMap.get(userId);
      oauth2Client.setCredentials(tokens);
      
      // Verify the token is still valid (by making a simple API call)
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      await calendar.calendarList.get({ calendarId: 'primary' });
      
      // If we got here, the token is valid
      console.log('Using existing valid tokens for user:', userId);
      return oauth2Client;
    } catch (error) {
      console.log('Token validation failed for user:', userId, error.message);
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
  
  console.log('Generated new auth URL');
  return authUrl; // Return the URL for the frontend to use
}

// Updated setTokens function with better error handling
async function setTokens(code) {
  try {
    console.log('Getting tokens with code');
    const { tokens: newTokens } = await oauth2Client.getToken(code);
    
    // Verify we got the expected tokens
    if (!newTokens || !newTokens.access_token) {
      throw new Error('Invalid tokens received from Google');
    }
    
    console.log('Received valid tokens');
    
    // Decode the ID token to get the user ID
    const ticket = await oauth2Client.verifyIdToken({
      idToken: newTokens.id_token,
      audience: GOOGLE_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    const userId = payload.sub;
    
    // Store tokens in the map
    userTokensMap.set(userId, newTokens);
    
    // Set the credentials for this request
    oauth2Client.setCredentials(newTokens);
    
    // Return the configured client
    return { oauth2Client, userId };
  } catch (error) {
    console.error('Error getting tokens:', error);
    throw new Error(`Failed to authorize with Google: ${error.message}`);
  }
}

// Get upcoming events with improved error handling and logging
async function getUpcomingEvents(userId, maxResults = 10, timeMin = null, timeMax = null) {
  // Log the request details for debugging
  console.log(`getUpcomingEvents called for userId: ${userId}`);
  console.log(`Parameters: maxResults=${maxResults}, timeMin=${timeMin}, timeMax=${timeMax}`);
  console.log(`User has token: ${userTokensMap.has(userId)}`);
  
  // Get the user's tokens
  if (!userId || !userTokensMap.has(userId)) {
    console.log('No tokens available for user:', userId);
    
    try {
      // Try to get authorization
      const authUrl = await authorize(userId);
      
      // If authorize returns a URL, it means we need user authorization
      if (typeof authUrl === 'string') {
        console.log('User needs to authorize. Auth URL generated:', authUrl);
        throw new Error('Not authorized - please authorize first');
      }
    } catch (authError) {
      console.error('Authorization error:', authError);
      throw authError;
    }
  }

  try {
    // Set the OAuth client with user's tokens
    const userTokens = userTokensMap.get(userId);
    console.log('Using tokens for user:', userId);
    oauth2Client.setCredentials(userTokens);
    
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    const now = timeMin ? new Date(timeMin) : new Date();
    
    const queryParams = {
      calendarId: CALENDAR_ID,
      timeMin: now.toISOString(),
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    };
    
    // Add timeMax if provided
    if (timeMax) {
      queryParams.timeMax = new Date(timeMax).toISOString();
    }
    
    console.log('Sending calendar API request with params:', queryParams);
    
    const response = await calendar.events.list(queryParams);
    
    const events = response.data.items;
    if (!events || events.length === 0) {
      console.log('No upcoming events found.');
      return [];
    }
    
    console.log(`Found ${events.length} upcoming events:`);
    events.forEach((event, i) => {
      const start = event.start.dateTime || event.start.date;
      const end = event.end.dateTime || event.end.date;
      console.log(`${i + 1}. ${event.summary} (${start} to ${end})`);
    });
    
    return events;
  } catch (error) {
    console.error('Error getting calendar events:', error);
    
    // If token is invalid, clean it up
    if (error.message.includes('invalid_grant') || error.message.includes('Invalid Credentials')) {
      console.log('Removing invalid token for user:', userId);
      userTokensMap.delete(userId);
    }
    
    throw error;
  }
}

// Process natural language to calendar event
async function parseNaturalLanguageToEvent(naturalText) {
  try {
    const prompt = `
    Convert the following natural language text into a calendar event in JSON format.
    Extract the title, start time, end time, and description.
    Current time is ${new Date().toISOString()}.
    
    Example output:
    {
      "summary": "Meeting with team",
      "start": "2023-06-15T14:00:00",
      "end": "2023-06-15T15:00:00",
      "description": "Quarterly planning meeting"
    }
    
    Input: "${naturalText}"
    `;
    
    const response = await groq.chat.completions.create({
      model: "llama3-70b-8192",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that converts natural language to calendar events."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 500
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from AI');
    
    // Extract JSON from response
    const jsonStart = content.indexOf('{');
    const jsonEnd = content.lastIndexOf('}') + 1;
    const jsonString = content.slice(jsonStart, jsonEnd);
    
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error parsing natural language:', error);
    throw error;
  }
}

// Update addEvent function to use user's tokens
async function addEvent(eventData, userId) {
  // Check if we have tokens for this user
  if (!userId || !userTokensMap.has(userId)) {
    console.log('No tokens available for user:', userId);
    const authUrl = await authorize(userId);
    
    // If authorize returns a URL, it means we need user authorization
    if (typeof authUrl === 'string') {
      throw new Error('Not authorized - please authorize first');
    }
  }

  // Set the OAuth client with user's tokens
  oauth2Client.setCredentials(userTokensMap.get(userId));
  
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  
  // Validate and format dates
  const start = parseISO(eventData.start);
  const end = parseISO(eventData.end);
  
  if (isNaN(start.getTime())) throw new Error('Invalid start date');
  if (isNaN(end.getTime())) throw new Error('Invalid end date');
  
  const event = {
    summary: eventData.summary,
    description: eventData.description || '',
    start: {
      dateTime: start.toISOString(),
      timeZone: 'UTC',
    },
    end: {
      dateTime: end.toISOString(),
      timeZone: 'UTC',
    },
  };
  
  const response = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    resource: event,
  });
  
  console.log('Event created: %s', response.data.htmlLink);
  return response.data;
}

// Main function to handle natural language input
async function handleNaturalLanguageInput(inputText, userId) {
  try {
    console.log('Processing:', inputText, 'for user:', userId);
    
    // Parse natural language to event data
    const eventData = await parseNaturalLanguageToEvent(inputText);
    console.log('Parsed event data:', eventData);
    
    // Add event to calendar
    const createdEvent = await addEvent(eventData, userId);
    return createdEvent;
  } catch (error) {
    console.error('Error handling natural language input:', error);
    throw error;
  }
}

module.exports = {
  authorize,
  setTokens,
  getUpcomingEvents,
  handleNaturalLanguageInput,
  addEvent,
  setGoogleTokens  // Export the new method
};