import axios from 'axios';

/**
 * API service for interacting with the backend
 */

const API_BASE_URL = 'http://localhost:3000/api';
const API_URL = process.env.NODE_ENV === 'production' 
  ? '/api' 
  : 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let authToken = null;

// Add a request interceptor to attach the auth token to every request
api.interceptors.request.use(
  (config) => {
    if (authToken) {
      config.headers['Authorization'] = `Bearer ${authToken}`;
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

const setAuthToken = (token) => {
  authToken = token;
};

const clearAuthToken = () => {
  authToken = null;
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
  toggleTracking,
  getTrackingStatus,
};
