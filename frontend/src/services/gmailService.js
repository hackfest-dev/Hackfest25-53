import api from './api';

const gmailService = {
  /**
   * Check if the user is authenticated with Google for Gmail
   */
  async checkGoogleAuth() {
    try {
      const response = await api.get('/api/gmail/auth-status');
      return response.data.success && response.data.user.hasGmailTokens ? response.data.user : null;
    } catch (error) {
      console.error('Error checking Gmail auth status:', error);
      return null;
    }
  },

  /**
   * Get the Gmail authorization URL
   */
  async getAuthUrl() {
    try {
      const response = await api.get('/api/gmail/auth/url');
      return response.data.success ? response.data.authUrl : null;
    } catch (error) {
      console.error('Error getting Gmail auth URL:', error);
      throw error;
    }
  },

  /**
   * Refresh Google token for Gmail access
   */
  async refreshGoogleToken() {
    try {
      const response = await api.post('/api/gmail/refresh-token');
      return response.data.success;
    } catch (error) {
      console.error('Error refreshing Google token:', error);
      throw error;
    }
  },

  /**
   * Get emails from the Gmail API
   */
  async getEmails(maxResults = 100) {
    try {
      // Add cache-busting to ensure we get fresh data
      const timestamp = new Date().getTime();
      const response = await api.get(`/api/gmail/emails?maxResults=${maxResults}&_t=${timestamp}`);
      return response.data;
    } catch (error) {
      // If we get a 401 or 403, we need to handle authorization
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        try {
          const authUrl = await this.getAuthUrl();
          if (authUrl) {
            // Pass the error up with the auth URL for handling in the component
            error.authUrl = authUrl;
          }
        } catch (authError) {
          console.error('Error getting auth URL:', authError);
        }
      }
      
      throw error;
    }
  }
};

export default gmailService;
