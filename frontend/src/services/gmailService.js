import api from './api';

const gmailService = {
  /**
   * Check if the user is authenticated with Google for Gmail
   */
  async checkGoogleAuth() {
    try {
      const response = await api.get('/gmail/auth-status');
      
      if (response.data.success && response.data.user) {
        console.log("Gmail auth check result:", response.data.user);
        
        // If using Google auth but missing Gmail tokens, try to set them automatically
        if (response.data.user.isGoogleAuth && !response.data.user.hasGmailTokens) {
          try {
            await this.setupGmailTokens();
          } catch (setupError) {
            console.error('Auto-setup of Gmail tokens failed:', setupError);
          }
        }
        
        return response.data.user;
      }
      return null;
    } catch (error) {
      console.error('Error checking Gmail auth status:', error);
      return null;
    }
  },
  
  /**
   * Set up Gmail tokens using the stored Google tokens
   */
  async setupGmailTokens() {
    // Try to get Google token data from localStorage
    const tokenDataStr = localStorage.getItem('googleTokenData');
    if (!tokenDataStr) {
      throw new Error('No Google token data available');
    }
    
    // Parse the token data
    const tokenData = JSON.parse(tokenDataStr);
    
    // Get current user info
    const auth = await import('firebase/auth').then(module => module.getAuth());
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not logged in');
    }
    
    // Send the token data to the server
    const response = await api.post('/gmail/set-gmail-token', {
      googleToken: tokenData,
      userInfo: {
        sub: user.uid,
        email: user.email
      }
    });
    
    return response.data.success;
  },

  /**
   * Get the Gmail authorization URL
   */
  async getAuthUrl() {
    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await api.get('/gmail/auth/url', {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.data?.success && response.data?.authUrl) {
        return response.data.authUrl;
      }
      console.error('Invalid auth URL response:', response.data);
      return null;
    } catch (error) {
      console.error('Error getting Gmail auth URL:', error);
      if (error.name === 'AbortError') {
        throw new Error('Request timed out when getting auth URL');
      }
      throw error;
    }
  },

  /**
   * Refresh Google token for Gmail access
   */
  async refreshGoogleToken() {
    try {
      const response = await api.post('/gmail/refresh-token');
      return response.data.success;
    } catch (error) {
      console.error('Error refreshing Google token:', error);
      // Check if we got a specific error message about Gmail permissions
      if (error.response?.data?.needsGmailPermissions) {
        error.needsGmailPermissions = true;
      }
      throw error;
    }
  },

  /**
   * Force a Gmail token refresh using the current Google tokens
   */
  async forceTokenRefresh() {
    try {
      // First try the standard refresh
      await this.refreshGoogleToken();
      
      // If that doesn't work, try setting up tokens from scratch
      const success = await this.setupGmailTokens();
      return success;
    } catch (error) {
      console.error('Force token refresh failed:', error);
      throw error;
    }
  },

  /**
   * Get emails from the Gmail API
   */
  async getEmails(maxResults = 30) {
    try {
      // Add cache-busting to ensure we get fresh data
      const timestamp = new Date().getTime();
      
      // Set a timeout for this request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await api.get(`/gmail/emails?maxResults=${maxResults}&_t=${timestamp}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.data;
    } catch (error) {
      console.error('Error fetching emails:', error);
      
      // Check for token issues - try to refresh automatically
      if (error.response?.status === 401 || 
          error.response?.data?.error?.includes('token') ||
          error.message?.includes('token')) {
        try {
          console.log('Trying to refresh Gmail tokens automatically...');
          await this.forceTokenRefresh();
          
          // Try the request again with fresh tokens
          console.log('Retrying email fetch with fresh tokens...');
          const newResponse = await api.get(`/gmail/emails?maxResults=${maxResults}&_t=${Date.now()}`);
          return newResponse.data;
        } catch (refreshError) {
          console.error('Auto-refresh failed:', refreshError);
          error.needsAuthorization = true;
          error.autoRefreshFailed = true;
        }
      }
      
      // Enhanced error handling
      if (error.response) {
        // If we have a response with an error, extract useful info
        const status = error.response.status;
        const errorData = error.response.data;
        
        if (status === 401 || status === 403) {
          // This is an authorization issue
          error.needsAuthorization = true;
          
          if (errorData.needsGmailPermissions) {
            // The user is logged in with Google but needs Gmail-specific permissions
            error.needsGmailPermissions = true;
          }
          
          // Try to get the auth URL to help with re-authorization
          try {
            const authUrl = await this.getAuthUrl();
            if (authUrl) {
              error.authUrl = authUrl;
            }
          } catch (authError) {
            console.error('Error getting auth URL:', authError);
          }
        } else if (status === 500) {
          // Server error - provide more context
          error.serverError = true;
          error.errorMessage = errorData.error || errorData.message || 'Internal server error';
          
          // If the error is related to the AI service
          if (errorData.message && errorData.message.includes('AI')) {
            error.aiError = true;
            error.errorMessage = 'Email prioritization service unavailable, but emails were retrieved';
          }
        } else if (status === 504) {
          // Gateway timeout error - usually the Gmail API taking too long
          error.timeout = true;
          error.errorMessage = 'The Gmail API request timed out. Please try again.';
        }
      }
      
      throw error;
    }
  }
};

export default gmailService;
