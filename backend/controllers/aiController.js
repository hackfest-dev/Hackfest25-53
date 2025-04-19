const { createLogger } = require('../utils/logger');
const aiService = require('../services/aiService');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const logger = createLogger('ai-controller');

// Configure multer for temporary storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

/**
 * Get daily AI tip for the user
 */
exports.getDailyTip = async (req, res) => {
  try {
    const userId = req.user?.uid || 'anonymous';
    const location = req.query.location || 'New York'; // Default location if none provided
    
    logger.info(`Generating daily tips for user: ${userId}, location: ${location}`);
    logger.info(`Auth status: ${req.user ? 'Authenticated' : 'Not authenticated'}`);
    
    // Get calendar events for today and tomorrow
    let calendarEvents = [];
    let hasConflictingEvents = false;
    let hasOutdoorEvents = false;
    let detectedConflicts = [];
    let outdoorEventDetails = [];
    let importantEvents = [];
    
    try {
      // Correctly import the calendarManager instead of calendarService
      const calendarManager = require('../services/calendarManager');
      
      // Get today's date at midnight
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get tomorrow's date at midnight
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // End of tomorrow
      const endOfTomorrow = new Date(tomorrow);
      endOfTomorrow.setHours(23, 59, 59, 999);
      
      // Debug user authentication status
      logger.info(`User details for calendar: ${JSON.stringify(req.user || {})}`);
      
      // Fetch calendar events if user is authenticated
      if (req.user && req.user.uid) {
        logger.info(`Attempting to fetch calendar events for user ${req.user.uid}`);
        
        try {
          // Use the proper method from calendarManager
          calendarEvents = await calendarManager.getUpcomingEvents(
            req.user.uid,
            15, // maxResults
            today.toISOString(),
            endOfTomorrow.toISOString()
          );
          
          // IMPORTANT: Log the actual calendar events to see what's being received
          logger.info(`Successfully fetched ${calendarEvents.length} calendar events`);
          logger.info(`Calendar events: ${JSON.stringify(calendarEvents)}`);
          
          // If no real events, use mock data for testing if we're in development
          if (calendarEvents.length === 0 && process.env.NODE_ENV !== 'production') {
            logger.info('No real calendar events found, using mock events for development');
            calendarEvents = getMockCalendarEvents(today);
            logger.info(`Added ${calendarEvents.length} mock calendar events`);
          }
        } catch (fetchError) {
          // Check if the error is due to authorization
          if (fetchError.message.includes('Not authorized')) {
            logger.warn(`Calendar authorization required for user ${req.user.uid}`);
            
            // In development, use mock events for testing
            if (process.env.NODE_ENV !== 'production') {
              logger.info('Using mock calendar events due to auth requirement');
              calendarEvents = getMockCalendarEvents(today);
              logger.info(`Added ${calendarEvents.length} mock calendar events`);
            }
          } else {
            logger.error(`Error fetching calendar events: ${fetchError.message}`);
            logger.error(fetchError.stack);
            
            // Use mock events in development for testing
            if (process.env.NODE_ENV !== 'production') {
              logger.info('Using mock calendar events due to fetch error');
              calendarEvents = getMockCalendarEvents(today);
            }
          }
        }
      } else {
        logger.warn(`Cannot fetch calendar events: User not authenticated or missing user ID`);
        
        // Use mock calendar data in development mode for testing
        if (process.env.NODE_ENV !== 'production') {
          logger.info('Using mock calendar events for development testing');
          calendarEvents = getMockCalendarEvents(today);
        }
      }
      
      // Rest of the event analysis logic
      if (calendarEvents.length > 1) {
        const eventTimePairs = calendarEvents.map(event => {
          const start = new Date(event.start.dateTime || event.start.date);
          const end = new Date(event.end.dateTime || event.end.date);
          const location = event.location || '';
          const importantKeywords = ['urgent', 'important', 'critical', 'meeting', 'deadline', 'presentation', 'interview'];
          const summary = (event.summary || '').toLowerCase();
          const description = (event.description || '').toLowerCase();
          const isImportant = importantKeywords.some(keyword => 
            summary.includes(keyword) || description.includes(keyword)
          );
          
          if (isImportant) {
            importantEvents.push({
              title: event.summary,
              start: start,
              end: end,
              location: location
            });
          }
          
          return { 
            event, 
            start, 
            end, 
            location,
            isImportant
          };
        });
        
        eventTimePairs.sort((a, b) => a.start - b.start);
        
        for (let i = 0; i < eventTimePairs.length - 1; i++) {
          const current = eventTimePairs[i];
          
          for (let j = i + 1; j < eventTimePairs.length; j++) {
            const next = eventTimePairs[j];
            
            if (current.end > next.start) {
              hasConflictingEvents = true;
              const overlapStart = next.start > current.start ? next.start : current.start;
              const overlapEnd = next.end < current.end ? next.end : current.end;
              const overlapMinutes = Math.round((overlapEnd - overlapStart) / 60000);
              const priorityEvent = current.isImportant && !next.isImportant ? current.event.summary :
                                    next.isImportant && !current.isImportant ? next.event.summary : null;
              
              detectedConflicts.push({
                event1: current.event.summary,
                event2: next.event.summary,
                time1: current.start.toLocaleTimeString() + ' - ' + current.end.toLocaleTimeString(),
                time2: next.start.toLocaleTimeString() + ' - ' + next.end.toLocaleTimeString(),
                overlapMinutes: overlapMinutes,
                date: current.start.toLocaleDateString(),
                priorityEvent: priorityEvent,
                location1: current.location,
                location2: next.location
              });
            }
          }
        }
        
        const outdoorKeywords = ['park', 'outdoor', 'hike', 'walk', 'run', 'jog', 'picnic', 'garden', 'outside', 'field', 'beach', 'playground', 'stadium'];
        const outdoorEventTypes = ['hiking', 'running', 'walking', 'jogging', 'picnic', 'sports', 'cycling', 'swimming', 'beach', 'park'];
        
        calendarEvents.forEach(event => {
          const summary = (event.summary || '').toLowerCase();
          const description = (event.description || '').toLowerCase();
          const location = (event.location || '').toLowerCase();
          
          const isOutdoor = outdoorKeywords.some(keyword => 
            summary.includes(keyword) || description.includes(keyword) || location.includes(keyword)
          );
          
          if (isOutdoor) {
            hasOutdoorEvents = true;
            let eventType = 'general outdoor';
            for (const type of outdoorEventTypes) {
              if (summary.includes(type) || description.includes(type)) {
                eventType = type;
                break;
              }
            }
            
            const start = new Date(event.start.dateTime || event.start.date);
            const end = new Date(event.end.dateTime || event.end.date);
            const duration = Math.round((end - start) / 60000);
            
            outdoorEventDetails.push({
              title: event.summary,
              type: eventType,
              start: start.toLocaleTimeString(),
              end: end.toLocaleTimeString(),
              date: start.toLocaleDateString(),
              duration: duration,
              location: event.location || 'No location specified'
            });
          }
        });
      }
      
      logger.info(`Fetched ${calendarEvents.length} calendar events for tip generation`);
      if (hasConflictingEvents) {
        logger.info(`Detected ${detectedConflicts.length} conflicting events`);
      }
      if (hasOutdoorEvents) {
        logger.info(`Detected ${outdoorEventDetails.length} outdoor events`);
      }
    } catch (calendarError) {
      logger.error(`Calendar service error: ${calendarError.message}`);
      logger.error(calendarError.stack);
      calendarEvents = [];
      
      if (process.env.NODE_ENV !== 'production') {
        calendarEvents = getMockCalendarEvents(new Date());
        logger.info(`Added ${calendarEvents.length} mock calendar events after error`);
      }
    }
    
    // Get weather data if available
    let weatherData = null;
    try {
      const weatherService = require('../services/weatherService');
      weatherData = await weatherService.getWeatherForLocation(location);
      logger.info(`Fetched weather data for ${location} for tip generation`);
    } catch (weatherError) {
      logger.error(`Error fetching weather data: ${weatherError.message}`);
    }
    
    const context = {
      calendarEvents: JSON.stringify(calendarEvents),
      weatherData: weatherData ? JSON.stringify(weatherData) : 'No weather data available',
      userId,
      currentTime: new Date().toISOString(),
      hasConflictingEvents,
      hasOutdoorEvents,
      detectedConflicts: JSON.stringify(detectedConflicts),
      outdoorEventDetails: JSON.stringify(outdoorEventDetails),
      importantEvents: JSON.stringify(importantEvents)
    };
    
    const prompt = `
      Generate 2-4 personalized and highly specific assistant tips based on the user's data.
      
      CALENDAR EVENTS: ${JSON.stringify(calendarEvents)}
      
      WEATHER DATA: ${weatherData ? JSON.stringify(weatherData.current) : 'No weather data available'}
      
      DETECTED CONFLICTS: ${JSON.stringify(detectedConflicts)}
      
      OUTDOOR EVENTS: ${JSON.stringify(outdoorEventDetails)}
      
      IMPORTANT EVENTS: ${JSON.stringify(importantEvents)}
      
      INSTRUCTIONS:
      1. If there are conflicting events (${hasConflictingEvents ? 'YES - CONFLICTS DETECTED' : 'No conflicts detected'}):
         - Provide specific warnings about each conflict with actual event names
         - Suggest which event to prioritize if you can determine importance
         - Recommend specific actions (reschedule, shorten, or find alternative times)
      
      2. If there are outdoor events (${hasOutdoorEvents ? 'YES - OUTDOOR EVENTS DETECTED' : 'No outdoor events detected'}):
         - Provide weather-appropriate advice for EACH specific outdoor event
         - Tailor recommendations to the specific activity type (hiking, sports, picnic, etc.)
         - Include specific details like temperatures, rain probability, or UV index if relevant
      
      3. For any important events, offer specific preparation advice
      
      4. Each tip should be concise (under 150 characters) but highly contextual with specific event details
      
      5. Return 2-4 tips in this JSON format:
      [
        {
          "tip": "Specific tip text mentioning actual event names",
          "tipType": "meeting|weather|productivity|general"
        },
        ...
      ]
      
      RESPONSE FORMAT: Return ONLY a valid JSON array of tips.
    `;
    
    let tipsResponse;
    
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('AI request timed out')), 6000);
      });
      
      tipsResponse = await Promise.race([
        aiService.queryGroqAI(prompt, context),
        timeoutPromise
      ]);
    } catch (timeoutError) {
      logger.warn(`AI service timed out: ${timeoutError.message}`);
      tipsResponse = JSON.stringify(
        generateFallbackTips(calendarEvents, weatherData, hasConflictingEvents, hasOutdoorEvents, detectedConflicts, outdoorEventDetails)
      );
    }
    
    let tips = [];
    try {
      const jsonMatch = tipsResponse.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (jsonMatch) {
        tips = JSON.parse(jsonMatch[0]);
      } else {
        tips = JSON.parse(tipsResponse);
      }
      
      tips = tips.map(tip => {
        if (!tip.tipType) {
          tip.tipType = 'general';
        }
        return tip;
      });
      
      if (tips.length < 2) {
        logger.warn(`AI returned only ${tips.length} tips, adding fallback tips`);
        const fallbackTips = generateFallbackTips(calendarEvents, weatherData, hasConflictingEvents, hasOutdoorEvents, detectedConflicts, outdoorEventDetails);
        tips = [...tips, ...fallbackTips.slice(0, 4 - tips.length)];
      }
      
      tips = tips.slice(0, 4);
    } catch (parseError) {
      logger.error(`Error parsing AI response as JSON: ${parseError.message}`);
      tips = generateFallbackTips(calendarEvents, weatherData, hasConflictingEvents, hasOutdoorEvents, detectedConflicts, outdoorEventDetails);
    }
    
    return res.json({
      success: true,
      tips
    });
  } catch (error) {
    logger.error(`Error generating daily tips: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to generate tips',
      message: error.message,
      tips: generateFallbackTips([], null, false, false, [], []) // Always provide fallback tips even on error
    });
  }
};

/**
 * Generate mock calendar events for testing
 */
function getMockCalendarEvents(baseDate) {
  const today = new Date(baseDate);
  const events = [];
  
  const morningMeeting = {
    id: 'mock-event-1',
    summary: 'Team Standup Meeting',
    description: 'Daily standup to discuss progress and blockers',
    start: {
      dateTime: new Date(today.setHours(9, 0, 0, 0)).toISOString(),
      timeZone: 'America/New_York'
    },
    end: {
      dateTime: new Date(today.setHours(9, 30, 0, 0)).toISOString(),
      timeZone: 'America/New_York'
    },
    location: 'Conference Room A',
    attendees: [
      { email: 'john@example.com' },
      { email: 'jane@example.com' }
    ]
  };
  
  const lunch = {
    id: 'mock-event-2',
    summary: 'Lunch with Client',
    description: 'Discuss new project proposal',
    start: {
      dateTime: new Date(today.setHours(12, 0, 0, 0)).toISOString(),
      timeZone: 'America/New_York'
    },
    end: {
      dateTime: new Date(today.setHours(13, 0, 0, 0)).toISOString(),
      timeZone: 'America/New_York'
    },
    location: 'Downtown Restaurant',
    attendees: [
      { email: 'client@example.com' }
    ]
  };
  
  const presentation = {
    id: 'mock-event-3',
    summary: 'Project Presentation',
    description: 'Present quarterly results to stakeholders',
    start: {
      dateTime: new Date(today.setHours(12, 30, 0, 0)).toISOString(),
      timeZone: 'America/New_York'
    },
    end: {
      dateTime: new Date(today.setHours(14, 0, 0, 0)).toISOString(),
      timeZone: 'America/New_York'
    },
    location: 'Main Conference Room',
    attendees: [
      { email: 'boss@example.com' },
      { email: 'team@example.com' }
    ]
  };
  
  const outdoorEvent = {
    id: 'mock-event-4',
    summary: 'Team Building: Park Walk',
    description: 'Outdoor team building activity',
    start: {
      dateTime: new Date(today.setHours(15, 0, 0, 0)).toISOString(),
      timeZone: 'America/New_York'
    },
    end: {
      dateTime: new Date(today.setHours(16, 30, 0, 0)).toISOString(),
      timeZone: 'America/New_York'
    },
    location: 'Central Park',
    attendees: [
      { email: 'team@example.com' }
    ]
  };
  
  events.push(morningMeeting, lunch, presentation, outdoorEvent);
  return events;
}

/**
 * Generate fallback tips when AI service fails or times out
 */
function generateFallbackTips(calendarEvents, weatherData, hasConflictingEvents, hasOutdoorEvents, detectedConflicts, outdoorEventDetails) {
  const tips = [];
  
  if (hasConflictingEvents && detectedConflicts.length > 0) {
    for (let i = 0; i < Math.min(2, detectedConflicts.length); i++) {
      const conflict = detectedConflicts[i];
      const event1 = conflict.event1 || 'Event 1';
      const event2 = conflict.event2 || 'Event 2';
      
      let conflictTip;
      
      if (conflict.priorityEvent) {
        const priorityEvent = conflict.priorityEvent;
        const otherEvent = priorityEvent === event1 ? event2 : event1;
        conflictTip = `Schedule conflict: "${event1}" and "${event2}" overlap for ${conflict.overlapMinutes} mins. Consider prioritizing "${priorityEvent}" and rescheduling "${otherEvent}".`;
      } else if (conflict.overlapMinutes < 30) {
        conflictTip = `Schedule conflict: "${event1}" and "${event2}" overlap briefly (${conflict.overlapMinutes} mins). Consider adjusting your arrival/departure times.`;
      } else {
        conflictTip = `Schedule conflict: "${event1}" and "${event2}" overlap for ${conflict.overlapMinutes} mins. You'll need to reschedule one of these events.`;
      }
      
      tips.push({
        tip: conflictTip.substring(0, 150),
        tipType: "meeting"
      });
      
      if (tips.length >= 4) break;
    }
  }
  
  if (weatherData && hasOutdoorEvents && outdoorEventDetails.length > 0) {
    for (let i = 0; i < Math.min(2, outdoorEventDetails.length); i++) {
      const event = outdoorEventDetails[i];
      const weather = weatherData.current;
      
      const eventTitle = event.title || 'outdoor event';
      const eventType = event.type || 'general outdoor';
      
      let weatherTip;
      
      const isRainy = weather.weather.toLowerCase().includes('rain') || 
                     (weather.description && weather.description.toLowerCase().includes('rain'));
      const isCold = weather.temp < 10;
      const isHot = weather.temp > 30;
      const isWindy = weather.wind_speed > 20;
      
      if (isRainy) {
        if (eventType.includes('hik') || eventType.includes('walk') || eventType.includes('run')) {
          weatherTip = `Rain expected during your ${eventTitle}. Bring waterproof gear and consider indoor alternatives if rain gets heavy.`;
        } else if (eventType.includes('picnic') || eventType.includes('beach')) {
          weatherTip = `Your ${eventTitle} may be affected by rain. Have a backup indoor location or reschedule to ${weatherData.daily?.[1]?.weather === 'Clear' ? 'tomorrow' : 'another day'}.`;
        } else {
          weatherTip = `Rain expected during your ${eventTitle}. Pack an umbrella and waterproof clothing.`;
        }
      } else if (isCold) {
        if (eventType.includes('run') || eventType.includes('jog') || eventType.includes('sport')) {
          weatherTip = `It's cold (${weather.temp}°C) for your ${eventTitle}. Dress in layers, wear gloves, and warm up properly before exercising.`;
        } else {
          weatherTip = `It's cold outside (${weather.temp}°C) for your ${eventTitle}. Dress warmly with layers and consider bringing a hot drink.`;
        }
      } else if (isHot) {
        if (eventType.includes('run') || eventType.includes('hik') || eventType.includes('sport')) {
          weatherTip = `High temperature (${weather.temp}°C) during your ${eventTitle}. Bring extra water, wear sunscreen, and consider rescheduling to early morning.`;
        } else {
          weatherTip = `It's hot today (${weather.temp}°C) for your ${eventTitle}. Stay hydrated, seek shade, and protect yourself from the sun.`;
        }
      } else if (isWindy) {
        weatherTip = `Windy conditions expected for your ${eventTitle}. Secure loose items and dress appropriately.`;
      } else {
        weatherTip = `Weather for your ${eventTitle}: ${weather.temp}°C with ${weather.description}. Ideal conditions for this activity!`;
      }
      
      tips.push({
        tip: weatherTip.substring(0, 150),
        tipType: "weather"
      });
      
      if (tips.length >= 4) break;
    }
  }
  
  if (tips.length < 4 && calendarEvents && calendarEvents.length > 0) {
    const importantEventKeywords = ['presentation', 'interview', 'meeting', 'deadline', 'exam', 'review'];
    const importantEvents = calendarEvents.filter(event => {
      const summary = (event.summary || '').toLowerCase();
      return importantEventKeywords.some(keyword => summary.includes(keyword));
    });
    
    if (importantEvents.length > 0) {
      const event = importantEvents[0];
      const eventTitle = event.summary;
      const eventTime = new Date(event.start.dateTime || event.start.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      
      let prepTip;
      
      if (eventTitle.toLowerCase().includes('presentation')) {
        prepTip = `Prepare for your "${eventTitle}" at ${eventTime} by reviewing your slides and practicing your delivery beforehand.`;
      } else if (eventTitle.toLowerCase().includes('interview')) {
        prepTip = `For your "${eventTitle}" at ${eventTime}, prepare answers to common questions and research the organization.`;
      } else if (eventTitle.toLowerCase().includes('meeting')) {
        prepTip = `Before your "${eventTitle}" at ${eventTime}, review the agenda and prepare any questions or talking points.`;
      } else {
        prepTip = `Don't forget about your "${eventTitle}" at ${eventTime}. Set a reminder and prepare any necessary materials.`;
      }
      
      tips.push({
        tip: prepTip.substring(0, 150),
        tipType: "meeting"
      });
    } else {
      tips.push({
        tip: `You have ${calendarEvents.length} events today. Review your calendar to prepare for your day and allocate travel time between appointments.`,
        tipType: "meeting"
      });
    }
  }
  
  if (tips.length < 2) {
    const productivityTips = [
      "Use the 2-minute rule: if a task takes less than 2 minutes, do it immediately instead of postponing it.",
      "Try the Pomodoro Technique: work for 25 minutes, then take a 5-minute break to maintain focus and productivity.",
      "Prioritize your top 3 tasks for the day and complete them before moving to less important items.",
      "Block distracting websites and notifications during your focus hours to maintain deep work.",
      "Take regular short breaks to prevent burnout and maintain productivity throughout the day."
    ];
    
    while (tips.length < 2) {
      const randomIndex = Math.floor(Math.random() * productivityTips.length);
      const tipText = productivityTips[randomIndex];
      
      if (!tips.some(tip => tip.tip === tipText)) {
        tips.push({
          tip: tipText,
          tipType: "productivity"
        });
      }
    }
  }
  
  return tips;
}

/**
 * Transcribe audio using Whisper
 */
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
    
    const audioDataLength = req.body.audio.length;
    logger.info(`Audio data received: ${audioDataLength} characters`);
    
    try {
      const audioBuffer = Buffer.from(req.body.audio, 'base64');
      logger.info(`Decoded base64 to buffer of length: ${audioBuffer.length}`);
      
      if (audioBuffer.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid audio data: empty buffer after decoding'
        });
      }
      
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

/**
 * Process image with AI
 */
exports.processImage = async (req, res) => {
  try {
    upload.single('image')(req, res, async (err) => {
      if (err) {
        logger.error(`Upload error: ${err.message}`);
        return res.status(400).json({
          success: false,
          error: 'File upload failed',
          message: err.message
        });
      }
      
      if (!req.file || !req.file.buffer) {
        logger.error('No image file received');
        return res.status(400).json({
          success: false,
          error: 'No image file received'
        });
      }
      
      const prompt = req.body.prompt || 'Describe this image in detail';
      
      try {
        const base64Image = req.file.buffer.toString('base64');
        const result = await aiService.handleImageWithOpenAI(prompt, base64Image);
        
        return res.json({
          success: true,
          result
        });
      } catch (imageError) {
        logger.error(`Image processing error: ${imageError.message}`);
        return res.status(500).json({
          success: false,
          error: 'Image processing failed',
          message: imageError.message
        });
      }
    });
  } catch (error) {
    logger.error(`General image processing error: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Image processing failed',
      message: error.message
    });
  }
};
