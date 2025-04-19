const axios = require('axios');
const { createLogger } = require('../utils/logger');
const config = require('../config/config');

const logger = createLogger('weather-service');

// OpenWeatherMap API key should be stored in your config
const WEATHER_API_KEY = config.apiKeys.openWeather || '436ccee582ab8d46003d6b90e5caeefd';

/**
 * Get weather data for a given location
 * @param {string} location - Location name (e.g., "New York, NY")
 * @returns {Promise<Object>} Weather data
 */
async function getWeatherForLocation(location) {
  try {
    logger.info(`Fetching weather for location: ${location}`);
    
    // Get coordinates from location name
    const geoResponse = await axios.get(
      `http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location)}&limit=1&appid=${WEATHER_API_KEY}`
    );
    
    if (!geoResponse.data || geoResponse.data.length === 0) {
      throw new Error(`Location not found: ${location}`);
    }
    
    const { lat, lon } = geoResponse.data[0];
    
    // Get current weather and forecast
    const weatherResponse = await axios.get(
      `https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&exclude=minutely,alerts&units=metric&appid=${WEATHER_API_KEY}`
    );
    
    const weather = weatherResponse.data;
    
    // Extract and format the relevant information
    return {
      current: {
        temp: weather.current.temp,
        feels_like: weather.current.feels_like,
        humidity: weather.current.humidity,
        wind_speed: weather.current.wind_speed,
        weather: weather.current.weather[0].main,
        description: weather.current.weather[0].description
      },
      hourly: weather.hourly.slice(0, 12).map(hour => ({
        time: new Date(hour.dt * 1000).toLocaleTimeString(),
        temp: hour.temp,
        weather: hour.weather[0].main,
        description: hour.weather[0].description,
        precipitation: hour.pop * 100 // Probability of precipitation in percentage
      })),
      daily: weather.daily.slice(0, 5).map(day => ({
        date: new Date(day.dt * 1000).toLocaleDateString(),
        temp_min: day.temp.min,
        temp_max: day.temp.max,
        weather: day.weather[0].main,
        description: day.weather[0].description
      }))
    };
  } catch (error) {
    logger.error(`Weather service error: ${error.message}`);
    
    // If API fails, return mock data for development
    logger.info('Using mock weather data');
    return getMockWeatherData();
  }
}

// Mock weather data for development/fallback
function getMockWeatherData() {
  const now = new Date();
  return {
    current: {
      temp: 20,
      feels_like: 19,
      humidity: 65,
      wind_speed: 5,
      weather: 'Clouds',
      description: 'scattered clouds'
    },
    hourly: Array.from({ length: 12 }, (_, i) => {
      const hourTime = new Date(now);
      hourTime.setHours(now.getHours() + i);
      
      // Add some rain in the afternoon
      const isRainy = i >= 3 && i <= 7;
      
      return {
        time: hourTime.toLocaleTimeString(),
        temp: 20 + Math.floor(Math.random() * 5) - 2,
        weather: isRainy ? 'Rain' : 'Clouds',
        description: isRainy ? 'light rain' : 'scattered clouds',
        precipitation: isRainy ? 30 + Math.floor(Math.random() * 60) : 0
      };
    })
  };
}

module.exports = {
  getWeatherForLocation
};
