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

// Global variable to store tokens
let tokens = null;

// Updated authorize function to better handle token state
async function authorize() {
  // Check for valid tokens first
  if (tokens && tokens.access_token) {
    try {
      // Set the credentials
      oauth2Client.setCredentials(tokens);
      
      // Verify the token is still valid (by making a simple API call)
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      await calendar.calendarList.get({ calendarId: 'primary' });
      
      // If we got here, the token is valid
      console.log('Using existing valid tokens');
      return oauth2Client;
    } catch (error) {
      console.log('Token validation failed, will request new authorization', error.message);
      // Token is invalid, continue to generate new auth URL
      tokens = null;
    }
  }

  // Create auth URL for new authorization
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Force consent screen to ensure we get refresh token
  });
  
  console.log('Generated new auth URL:', authUrl);
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
    tokens = newTokens;
    oauth2Client.setCredentials(tokens);
    
    // Return the configured client
    return oauth2Client;
  } catch (error) {
    console.error('Error getting tokens:', error);
    throw new Error(`Failed to authorize with Google: ${error.message}`);
  }
}

// Get upcoming events
async function getUpcomingEvents(maxResults = 10) {
  if (!tokens) {
    await authorize();
    throw new Error('Not authorized - please authorize first');
  }

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  
  const now = new Date();
  const response = await calendar.events.list({
    calendarId: CALENDAR_ID,
    timeMin: now.toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  });
  
  const events = response.data.items;
  if (!events || events.length === 0) {
    console.log('No upcoming events found.');
    return [];
  }
  
  console.log('Upcoming events:');
  events.forEach((event, i) => {
    const start = event.start.dateTime || event.start.date;
    const end = event.end.dateTime || event.end.date;
    console.log(`${i + 1}. ${event.summary} (${start} to ${end}`);
  });
  
  return events;
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

// Update addEvent function to clearly differentiate auth errors
async function addEvent(eventData) {
  // Check if we have tokens available
  if (!tokens || !tokens.access_token) {
    console.log('No tokens available, authorization required');
    const authUrl = await authorize();
    
    // If authorize returns a URL, it means we need user authorization
    if (typeof authUrl === 'string') {
      throw new Error('Not authorized - please authorize first');
    }
  }

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
async function handleNaturalLanguageInput(inputText) {
  try {
    console.log('Processing:', inputText);
    
    // Parse natural language to event data
    const eventData = await parseNaturalLanguageToEvent(inputText);
    console.log('Parsed event data:', eventData);
    
    // Add event to calendar
    const createdEvent = await addEvent(eventData);
    return createdEvent;
  } catch (error) {
    console.error('Error handling natural language input:', error);
    throw error;
  }
}

// Example usage
async function main() {
  try {
    // For testing, you would first need to get an authorization code
    // Then call setTokens(your_code) before other operations
    
    // Get upcoming events
    await getUpcomingEvents();
    
    // Example natural language input
    const naturalInput = "Schedule a meeting with the marketing team tomorrow at 2pm for 1 hour about the new campaign";
    await handleNaturalLanguageInput(naturalInput);
    
    // Get updated events
    await getUpcomingEvents();
  } catch (error) {
    console.error('Error in main:', error);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  authorize,
  setTokens,
  getUpcomingEvents,
  handleNaturalLanguageInput,
  addEvent
};