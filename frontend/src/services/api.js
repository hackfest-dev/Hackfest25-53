import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

/**
 * API service for interacting with the backend
 */

const API_BASE_URL = 'http://localhost:3000/api';
const API_URL = process.env.NODE_ENV === 'production' 
  ? '/api' 
  : 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let currentToken = null;

// Add a request interceptor to attach the auth token to every request
api.interceptors.request.use(
  (config) => {
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
};

// Method to clear the auth token
const clearAuthToken = () => {
  currentToken = null;
};

// Method to get the decoded token for user info
const getDecodedToken = () => {
  if (!currentToken) return null;
  try {
    return jwtDecode(currentToken);
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};

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

export default {
  get: (url, config = {}) => api.get(url, config),
  post: (url, data, config = {}) => api.post(url, data, config),
  put: (url, data, config = {}) => api.put(url, data, config),
  delete: (url, config = {}) => api.delete(url, config),
  patch: (url, data, config = {}) => api.patch(url, data, config),
  setAuthToken,
  clearAuthToken,
  getDecodedToken,
  toggleTracking,
  getTrackingStatus,
};
