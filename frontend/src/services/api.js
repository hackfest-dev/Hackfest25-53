import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000 // 10 second timeout
});

// Add request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method.toUpperCase()} ${config.url}`);
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
