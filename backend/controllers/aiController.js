const { createLogger } = require('../utils/logger');
const aiService = require('../services/aiService');
const calendarManager = require('../services/calendarManager');
const weatherService = require('../services/weatherService');

const logger = createLogger('ai-controller');

exports.getDailyTip = async (req, res) => {
  try {
    const userId = req.user.uid;
    logger.info(`Generating daily tip for user: ${userId}`);
    
    // Step 1: Get today's events
    let events = [];
    let location = null;
    
    try {
      // Get today's date range
      const today = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(today.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      // Fetch today's events
      events = await calendarManager.getUpcomingEvents(
        userId, 
        10,
        today.toISOString(),
        tomorrow.toISOString()
      );
      
      logger.info(`Found ${events.length} events for today`);
      console.log('Calendar events retrieved:', events.map(e => e.summary));
    } catch (error) {
      logger.warn(`Failed to fetch calendar events: ${error.message}`);
      // Continue even if calendar events can't be fetched
    }
    
    // Step 2: Try to get user's location
    try {
      // This is a placeholder - in a real implementation, you'd get this from the user's profile
      // or use a geolocation service with proper permission
      
      // For demonstration, we'll use a hardcoded location
      location = "San Francisco, CA";
      logger.info(`User location: ${location}`);
      console.log('Using location:', location);
    } catch (error) {
      logger.warn(`Failed to get user location: ${error.message}`);
    }
    
    // Step 3: Get weather data if location is available
    let weatherData = null;
    if (location) {
      try {
        weatherData = await weatherService.getWeatherForLocation(location);
        logger.info(`Weather data retrieved for ${location}`);
        console.log('Weather data retrieved:', {
          current: weatherData.current,
          precipitation: weatherData.hourly.map(h => ({ time: h.time, precip: h.precipitation }))
        });
      } catch (error) {
        logger.warn(`Failed to fetch weather data: ${error.message}`);
      }
    }
    
    // Step 4: Determine tip type based on context
    let tipType = 'general';
    
    // Look for outdoor activities
    const outdoorKeywords = ['run', 'jog', 'hike', 'walk', 'bike', 'cycling', 'outdoor', 'park', 'garden'];
    const hasOutdoorEvent = events.some(event => 
      outdoorKeywords.some(keyword => 
        (event.summary || '').toLowerCase().includes(keyword) || 
        (event.description || '').toLowerCase().includes(keyword)
      )
    );
    
    // Check if there's rain in the forecast
    const hasRainForecast = weatherData?.hourly.some(hour => 
      hour.weather.toLowerCase().includes('rain') || 
      hour.precipitation > 30
    );
    
    // Check for back-to-back meetings
    const hasManyMeetings = events.length >= 3;
    
    // Determine tip type
    if (hasOutdoorEvent && hasRainForecast) {
      tipType = 'weather';
    } else if (hasManyMeetings) {
      tipType = 'meeting';
    } else if (events.length === 0 || events.length === 1) {
      tipType = 'productivity';
    }
    
    // Step 5: Construct context for AI
    const context = {
      events: events.map(event => ({
        title: event.summary,
        start: event.start.dateTime || event.start.date,
        end: event.end.dateTime || event.end.date,
        description: event.description || 'No description'
      })),
      weather: weatherData,
      location: location,
      date: new Date().toISOString(),
      tipType: tipType
    };
    
    logger.info(`Constructed context for AI with tipType: ${tipType}`);
    console.log('AI context prepared with tip type:', tipType);
    
    // Step 6: Generate tip using Groq AI
    const prompt = `
    Based on the following context, provide a helpful and specific tip for the day. 
    Be conversational but concise (50-80 words).
    
    Today's Date: ${new Date().toLocaleDateString()}
    Location: ${context.location || 'Unknown'}
    
    Weather: ${context.weather ? JSON.stringify(context.weather.current) : 'Weather data not available'}
    
    Hourly Forecast: ${context.weather ? JSON.stringify(context.weather.hourly.slice(0, 8)) : 'Forecast not available'}
    
    Today's Events:
    ${context.events.length > 0 
      ? context.events.map(e => `- ${e.title} (${new Date(e.start).toLocaleTimeString()} - ${new Date(e.end).toLocaleTimeString()})`).join('\n')
      : 'No events scheduled for today'
    }
    
    Tip Type: ${tipType}
    
    Example tips based on tip type:
    - Weather: "You have a run scheduled at 5pm, but it might rain around 4pm. Consider bringing waterproof gear or moving your run earlier to 3pm when it's still clear."
    - Meeting: "You have 5 back-to-back meetings from 1-4pm with no breaks. Consider blocking 10 minutes between meetings for a mental reset and prep for the next one."
    - Productivity: "No meetings until 11am. This morning is a great opportunity to tackle your most important task during your peak focus hours. Consider time-blocking 9-11am."
    - General: "Based on your recent activity patterns, you tend to be most productive between 9-11am. Try scheduling your most challenging tasks during this window."
    
    IMPORTANT: Provide just the tip itself, no additional text.
    `;
    
    const tipResponse = await aiService.queryGroqAI(prompt);
    
    // Clean up the response
    const tip = tipResponse.trim().replace(/^"(.*)"$/, '$1');
    
    logger.info(`Generated tip (${tipType}): ${tip}`);
    console.log(`Tip generated (${tipType}):`, tip);
    
    // Return the generated tip
    res.json({
      success: true,
      tip,
      tipType
    });
  } catch (error) {
    logger.error(`Error generating daily tip: ${error.message}`);
    console.error('Daily tip generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate daily tip',
      message: error.message
    });
  }
};

exports.transcribeAudio = async (req, res) => {
  try {
    logger.info('Received audio transcription request');
    
    if (!req.body || !req.body.audio) {
      logger.error('No audio data provided in request body');
      return res.status(400).json({
        success: false,
        error: 'No audio data provided in request'
      });
    }
    
    // Log some details about the audio data for debugging
    const audioDataLength = req.body.audio.length;
    logger.info(`Audio data received: ${audioDataLength} characters`);
    
    // Decode base64 audio data
    try {
      const audioBuffer = Buffer.from(req.body.audio, 'base64');
      logger.info(`Decoded base64 to buffer of length: ${audioBuffer.length}`);
      
      // Check if buffer is valid
      if (audioBuffer.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid audio data: empty buffer after decoding'
        });
      }
      
      // Call Whisper service to transcribe
      logger.info('Calling transcribeAudio service function');
      const transcription = await aiService.transcribeAudio(audioBuffer);
      
      if (!transcription || transcription.startsWith('Error:')) {
        logger.error(`Transcription service error: ${transcription}`);
        return res.status(500).json({
          success: false,
          error: transcription || 'Failed to transcribe audio'
        });
      }
      
      logger.info('Audio transcription completed successfully');
      logger.info(`Transcription result: "${transcription}"`);
      
      return res.json({
        success: true,
        text: transcription
      });
    } catch (decodeError) {
      logger.error(`Error decoding audio data: ${decodeError.message}`);
      return res.status(400).json({
        success: false,
        error: 'Invalid audio data: could not decode base64',
        details: decodeError.message
      });
    }
  } catch (error) {
    logger.error(`Error in audio transcription: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Failed to transcribe audio',
      message: error.message
    });
  }
};
