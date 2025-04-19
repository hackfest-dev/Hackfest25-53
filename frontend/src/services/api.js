import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

/**
 * API service for interacting with the backend
 */

// Consistent API URL configuration
const API_URL = process.env.NODE_ENV === 'production' 
  ? '/api' 
  : 'http://localhost:3000/api'; // Fix port to match backend (3000 not 5000)

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let currentToken = null;

// Add a request interceptor to attach the auth token to every request
api.interceptors.request.use(
  (config) => {
    // Log outgoing requests to help with debugging
    console.log(`API Request: ${config.method.toUpperCase()} ${config.baseURL}${config.url}`, {
      hasToken: !!currentToken,
      headers: config.headers
    });
    
    const token = currentToken;
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Provide more detailed error logging
    console.error('API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    
    if (error.response && error.response.status === 401) {
      console.error('Authentication error: User not authorized');
      // Optionally trigger logout or redirect to login page
    }
    return Promise.reject(error);
  }
);

// Method to set the auth token
const setAuthToken = (token) => {
  currentToken = token;
  localStorage.setItem('token', token); // Also store in localStorage for persistence
  console.log('Auth token set:', token ? 'Token present (hidden for security)' : 'No token');
};

// Method to clear the auth token
const clearAuthToken = () => {
  currentToken = null;
  localStorage.removeItem('token');
  console.log('Auth token cleared');
};

// Method to get the decoded token for user info
const getDecodedToken = () => {
  // Try to get token from state, then localStorage
  const token = currentToken || localStorage.getItem('token');
  if (!token) return null;
  
  try {
    return jwtDecode(token);
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};

// Initialize token from localStorage if available
const initToken = () => {
  const storedToken = localStorage.getItem('token');
  if (storedToken) {
    currentToken = storedToken;
    console.log('Auth token initialized from localStorage');
  }
};

// Call this function immediately to ensure token is loaded
initToken();

/**
 * Toggle the tracking service on or off
 * @param {boolean} enable - Whether to enable or disable tracking
 * @returns {Promise<Object>} Response object
 */
const toggleTracking = async (enable) => {
  try {
    const action = enable ? 'start' : 'stop';
    const response = await fetch(`${API_URL}/tracking/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API error toggling tracking:', error);
    throw error;
  }
};

/**
 * Get current tracking status
 * @returns {Promise<Object>} Response with tracking status
 */
const getTrackingStatus = async () => {
  try {
    const response = await fetch(`${API_URL}/tracking/status`);
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API error getting tracking status:', error);
    throw error;
  }
};

/**
 * Logout from WhatsApp
 * @returns {Promise<Object>} Response with logout status
 */
const logoutWhatsApp = async () => {
  try {
    const response = await api.post('/bot/logout');
    return response.data;
  } catch (error) {
    console.error('API error during WhatsApp logout:', error);
    throw error;
  }
};

/**
 * Health check for API connectivity
 * @returns {Promise<Object>} Response with health status
 */
const healthCheck = async () => {
  try {
    const response = await api.get('/test');
    return { isAlive: true, message: response.data.message };
  } catch (error) {
    console.error('API health check failed:', error);
    return { isAlive: false, message: error.message };
  }
};

/**
 * Get user's current location (city name)
 * @returns {Promise<string>} The user's location
 */
const getUserLocation = async () => {
  try {
    // Check cache first
    const cachedLocation = localStorage.getItem('userLocation');
    const cachedTimestamp = localStorage.getItem('userLocationTimestamp');
    
    // If we have a cached location that's less than 24 hours old, use it
    if (cachedLocation && cachedTimestamp) {
      const cacheAge = Date.now() - parseInt(cachedTimestamp, 10);
      if (cacheAge < 24 * 60 * 60 * 1000) { // 24 hours
        console.log('Using cached location:', cachedLocation);
        return cachedLocation;
      }
    }
    
    // First try to get location from browser geolocation
    if (navigator.geolocation) {
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000, // Reduced timeout to 5 seconds
            maximumAge: 3600000 // 1 hour cache
          });
        });
        
        const { latitude, longitude } = position.coords;
        
        // Reverse geocode to get city name
        const response = await fetch(
          `https://api.openweathermap.org/geo/1.0/reverse?lat=${latitude}&lon=${longitude}&limit=1&appid=436ccee582ab8d46003d6b90e5caeefd`
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.length > 0) {
            const location = data[0].name;
            // Cache the result
            localStorage.setItem('userLocation', location);
            localStorage.setItem('userLocationTimestamp', Date.now().toString());
            return location;
          }
        }
      } catch (geoError) {
        console.warn('Geolocation error:', geoError);
        // Continue to fallback methods
      }
    }
    
    // Fallback to IP-based geolocation with timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const ipResponse = await fetch('https://ipapi.co/json/', { 
        signal: controller.signal 
      });
      
      clearTimeout(timeoutId);
      
      if (ipResponse.ok) {
        const ipData = await ipResponse.json();
        if (ipData.city) {
          // Cache the result
          localStorage.setItem('userLocation', ipData.city);
          localStorage.setItem('userLocationTimestamp', Date.now().toString());
          return ipData.city;
        }
      }
    } catch (ipError) {
      console.warn('IP geolocation error:', ipError);
      // Fall through to default
    }
    
    // Use default if all else fails
    const defaultLocation = 'New York';
    localStorage.setItem('userLocation', defaultLocation);
    localStorage.setItem('userLocationTimestamp', Date.now().toString());
    return defaultLocation;
  } catch (error) {
    console.error('Error getting user location:', error);
    return 'New York'; // Default location on error
  }
};

/**
 * Check calendar authentication status
 * @returns {Promise<Object>} Response with calendar auth status
 */
const checkCalendarAuth = async () => {
  try {
    // Ensure token is loaded from localStorage
    initToken();
    
    // Make API call to check calendar auth
    const response = await api.get('/calendar/events');
    return { 
      isAuthorized: true, 
      events: response.data.events,
      message: 'Calendar access authorized'
    };
  } catch (error) {
    console.warn('Calendar auth check failed:', error.response?.data);
    
    // If we got an authUrl, return it so it can be handled
    if (error.response?.data?.authUrl) {
      return { 
        isAuthorized: false, 
        authUrl: error.response.data.authUrl,
        message: 'Calendar authorization required'
      };
    }
    
    return { 
      isAuthorized: false, 
      message: error.message
    };
  }
};

export default {
  get: (url, config = {}) => api.get(url, config),
  post: (url, data, config = {}) => api.post(url, data, config),
  put: (url, data, config = {}) => api.put(url, data, config),
  delete: (url, config = {}) => api.delete(url, config),
  patch: (url, data, config = {}) => api.patch(url, data, config),
  setAuthToken,
  clearAuthToken,
  getDecodedToken,
  initToken,
  toggleTracking,
  getTrackingStatus,
  logoutWhatsApp,
  healthCheck,
  getUserLocation,
  checkCalendarAuth, // Add this new method
};
