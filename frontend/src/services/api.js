import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000 // 10 second timeout
});

// Add auth token to requests
let authToken = null;

// Method to set auth token
api.setAuthToken = (token) => {
  authToken = token;
};

// Add request interceptor for logging and auth
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method.toUpperCase()} ${config.url}`);
    
    // Add auth token to headers if available
    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }
    
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for logging
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} from ${response.config.url}`);
    return response;
  },
  (error) => {
    if (error.code === 'ECONNABORTED') {
      console.error('API request timed out');
    } else if (!error.response) {
      console.error('Network Error: Cannot connect to the backend server');
    } else if (error.response.status === 401) {
      console.error('Authentication error: User not authorized');
      
      // Redirect to login if authentication fails
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    } else {
      console.error(`API Error ${error.response?.status}: ${error.response?.data?.message || error.message}`);
    }
    return Promise.reject(error);
  }
);

// Add a health check function
api.healthCheck = async () => {
  try {
    const response = await api.get('/test');
    return {
      isAlive: true,
      message: response.data.message
    };
  } catch (error) {
    return {
      isAlive: false,
      message: error.code === 'ECONNABORTED' 
        ? 'Connection timeout' 
        : error.message
    };
  }
};

export default api;
