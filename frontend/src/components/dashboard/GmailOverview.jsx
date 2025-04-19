import React, { useState, useEffect } from 'react';
import { FaEnvelope, FaExclamationCircle, FaArrowRight, FaSync, FaGoogle } from 'react-icons/fa';
import gmailService from '../../services/gmailService';

const PriorityBadge = ({ priority }) => {
  const colors = {
    high: 'bg-red-500',
    medium: 'bg-yellow-400',
    low: 'bg-green-500'
  };
  
  return (
    <span className={`${colors[priority] || 'bg-gray-500'} text-xs text-white px-2 py-1 rounded-full uppercase`}>
      {priority}
    </span>
  );
};

const EmailRow = ({ email }) => {
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    if (date > sevenDaysAgo) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };
  
  const truncate = (str, length = 40) => {
    return str.length > length ? str.substring(0, length) + '...' : str;
  };
  
  const getSenderName = (from) => {
    const match = from.match(/^(.+?)\s*<.*>$/);
    if (match) {
      return match[1].trim();
    }
    return from;
  };
  const scrollbarStyles = `
  .events-scroll::-webkit-scrollbar {
    width: 4px;
    background: transparent;
  }
  
  .events-scroll::-webkit-scrollbar-thumb {
    background: rgba(76, 61, 139, 0.5);
    border-radius: 4px;
  }
  
  .events-scroll::-webkit-scrollbar-thumb:hover {
    background: rgba(94, 78, 153, 0.7);
  }
  
  .events-scroll::-webkit-scrollbar-track {
    background: #1a1a1a;
    border-radius: 4px;
  }
  
  .events-scroll {
    scrollbar-width: thin;
    scrollbar-color: rgba(76, 61, 139, 0.5) transparent;
  }
`;

  return (
    <div className={`flex items-center border-b border-gray-700 p-2 hover:bg-gray-800 transition-colors ${email.priority === 'high' ? 'bg-gray-800' : ''}`}>
      <style>{scrollbarStyles}</style>
      <div className="flex-shrink-0 mr-3">
        <div className={`w-2 h-2 rounded-full ${email.priority === 'high' ? 'bg-red-500' : email.priority === 'medium' ? 'bg-yellow-400' : 'bg-green-500'}`}></div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between">
          <p className={`text-sm font-medium ${email.priority === 'high' ? 'text-white' : 'text-gray-300'}`}>
            {truncate(getSenderName(email.from))}
          </p>
          <p className="text-xs text-gray-500">{formatDate(email.date)}</p>
        </div>
        <p className={`text-xs ${email.priority === 'high' ? 'text-white' : 'text-gray-400'}`}>
          {truncate(email.subject)}
        </p>
        {email.priority === 'high' && (
          <p className="text-xs italic text-gray-500 mt-1">
            {truncate(email.priorityReason, 60)}
          </p>
        )}
      </div>
      <div className="ml-2">
        <a 
          href={email.link} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-blue-400 hover:text-blue-300"
          title="Open in Gmail"
        >
          <FaArrowRight size={12} />
        </a>
      </div>
    </div>
  );
};

const GmailOverview = () => {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [isAuthError, setIsAuthError] = useState(false);
  const [isGoogleUser, setIsGoogleUser] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  
  useEffect(() => {
    const checkGoogleAuth = async () => {
      try {
        setLoading(true);
        const userInfo = await gmailService.checkGoogleAuth();
        console.log("Gmail auth check result:", userInfo);
        
        // Check if the user has Google auth but may need Gmail permissions
        if (userInfo && userInfo.isGoogleAuth) {
          setIsGoogleUser(true);
          
          // If they have Gmail tokens, we're good to fetch emails
          if (userInfo.hasGmailTokens) {
            fetchEmails();
          } else {
            // They need to grant Gmail permissions - stop loading and show auth prompt
            setIsAuthError(true);
            setError('Gmail access required. Please click the button below to grant access to your Gmail.');
            setLoading(false); // Important: Stop loading when we know auth is needed
          }
        } else {
          setIsGoogleUser(false);
          setIsAuthError(userInfo === null);
          setLoading(false); // Stop loading if no auth
        }
        
        setAuthChecked(true);
      } catch (error) {
        console.error('Error checking Google auth:', error);
        setIsGoogleUser(false);
        setAuthChecked(true);
        setLoading(false); // Always ensure loading stops on error
        setError('Failed to check authentication status');
      }
    };
    
    checkGoogleAuth();
  }, []);
  
  const handleGoogleAuth = async () => {
    try {
      setLoading(true);
      
      if (isGoogleUser) {
        try {
          // Try to refresh the token first
          await gmailService.forceTokenRefresh(); // Use the new forceTokenRefresh function
          fetchEmails();
          return;
        } catch (refreshError) {
          console.error('Error refreshing token:', refreshError);
          // If refresh fails with a needsGmailPermissions flag, we need to get Gmail permissions
          if (refreshError.needsGmailPermissions) {
            console.log('User needs to grant Gmail permissions');
          } else {
            // For other errors, just continue to the auth URL flow
            console.log('Token refresh failed, continuing to auth URL flow');
          }
        }
      }
      
      // Get auth URL and open in new window
      const authUrl = await gmailService.getAuthUrl();
      
      if (!authUrl) {
        setError('Failed to get authorization URL');
        setLoading(false);
        return;
      }
      
      // Open the auth window
      const authWindow = window.open(authUrl, '_blank', 'width=500,height=600');
      
      // Ensure the window opened successfully
      if (!authWindow || authWindow.closed || typeof authWindow.closed === 'undefined') {
        setError('Popup window was blocked. Please allow popups for this site.');
        setLoading(false);
        return;
      }
      
      setError(null);
      setIsAuthError(false);
      
      // Check periodically if the auth window was closed
      const checkAuthInterval = setInterval(() => {
        if (authWindow && authWindow.closed) {
          clearInterval(checkAuthInterval);
          setTimeout(async () => {
            try {
              // Check if the authentication was successful
              const userInfo = await gmailService.checkGoogleAuth();
              if (userInfo && userInfo.hasGmailTokens) {
                setIsGoogleUser(true);
                setIsAuthError(false);
                fetchEmails();
              } else {
                // Try one more time to set up Gmail tokens
                try {
                  await gmailService.setupGmailTokens();
                  const retryUserInfo = await gmailService.checkGoogleAuth();
                  if (retryUserInfo && retryUserInfo.hasGmailTokens) {
                    setIsGoogleUser(true);
                    setIsAuthError(false);
                    fetchEmails();
                    return;
                  }
                } catch (setupError) {
                  console.error('Final Gmail token setup attempt failed:', setupError);
                }
                
                setError('Gmail authorization failed or was cancelled. Please try again.');
                setIsAuthError(true);
                setLoading(false);
              }
            } catch (authCheckError) {
              console.error('Error checking auth status after popup:', authCheckError);
              setError('Error verifying Gmail authorization. Please try again.');
              setIsAuthError(true);
              setLoading(false);
            }
          }, 1000);
        }
      }, 1000);
    } catch (error) {
      console.error('Error initiating Google auth:', error);
      setError(`Failed to initiate Google authorization: ${error.message}`);
      setLoading(false);
    }
  };
  
  const fetchEmails = async () => {
    try {
      setLoading(true);
      setError(null);
      setIsAuthError(false);
      
      // Add a timeout to prevent hanging requests
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 15000)
      );
      
      const emailsPromise = gmailService.getEmails(30);
      
      // Race between the actual request and the timeout
      const response = await Promise.race([emailsPromise, timeoutPromise]);
      
      if (response.success) {
        setEmails(response.emails || []);
        // Set the user's email address if available
        if (response.userEmail) {
          setUserEmail(response.userEmail);
        }
        setIsGoogleUser(true);
        setIsAuthError(false);
      } else {
        setError('Failed to fetch emails');
      }
    } catch (error) {
      console.error('Error fetching emails:', error);
      
      if (error.message === 'Request timeout') {
        setError('Request timed out. Please try again.');
      } else if (error.needsAuthorization) {
        setIsAuthError(true);
        
        if (error.needsGmailPermissions) {
          setError('Gmail access required. Please click the button below to grant access to your Gmail account.');
          setIsGoogleUser(true); // They have Google auth but need Gmail permissions
        } else {
          setError('Gmail authorization required. Please connect your Gmail account.');
          setIsGoogleUser(false);
        }
      } else if (error.serverError) {
        setError(`Server error: ${error.errorMessage || 'Unknown error'}`);
      } else {
        setError(error.message || 'Failed to fetch emails');
      }
    } finally {
      setLoading(false); // Always ensure loading stops
    }
  };
  
  const filteredEmails = priorityFilter === 'all' 
    ? emails 
    : emails.filter(email => email.priority === priorityFilter);
  
  const priorityCounts = emails.reduce((counts, email) => {
    counts[email.priority] = (counts[email.priority] || 0) + 1;
    return counts;
  }, {});

  const scrollbarStyles = `
  .events-scroll::-webkit-scrollbar {
    width: 4px;
    background: transparent;
  }
  
  .events-scroll::-webkit-scrollbar-thumb {
    background: rgba(76, 61, 139, 0.5);
    border-radius: 4px;
  }
  
  .events-scroll::-webkit-scrollbar-thumb:hover {
    background: rgba(94, 78, 153, 0.7);
  }
  
  .events-scroll::-webkit-scrollbar-track {
    background: #1a1a1a;
    border-radius: 4px;
  }
  
  .events-scroll {
    scrollbar-width: thin;
    scrollbar-color: rgba(76, 61, 139, 0.5) transparent;
  }
`;
  
  return (
    <div className="bg-[#121212] rounded-lg shadow-lg overflow-hidden h-full flex flex-col"
    style={{
      border: '0.5px solid #4B5563',
    }}>
      <style>{scrollbarStyles}</style>
      <div className="text-gray-300 text-sm font-medium pb-2 px-4 pt-3 bg-[#1C1B23] rounded-t-lg flex justify-between items-center">
        <div className="flex items-center">
          <span>GMAIL</span>
          {userEmail && (
            <span className="text-gray-400 text-xs ml-2">({userEmail})</span>
          )}
        </div>
        <button 
          onClick={fetchEmails} 
          className="text-gray-400 hover:text-white"
          title="Refresh emails"
        >
          <FaSync size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      
      {!isAuthError && (
        <div className="px-4 py-2 border-b border-gray-700 flex space-x-2">
          <button 
            onClick={() => setPriorityFilter('all')} 
            className={`text-xs px-3 py-1 rounded-full ${priorityFilter === 'all' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}
          >
            All ({emails.length})
          </button>
          <button 
            onClick={() => setPriorityFilter('high')} 
            className={`text-xs px-3 py-1 rounded-full ${priorityFilter === 'high' ? 'bg-red-500 text-white' : 'text-gray-400'}`}
          >
            High ({priorityCounts.high || 0})
          </button>
          <button 
            onClick={() => setPriorityFilter('medium')} 
            className={`text-xs px-3 py-1 rounded-full ${priorityFilter === 'medium' ? 'bg-yellow-400 text-white' : 'text-gray-400'}`}
          >
            Medium ({priorityCounts.medium || 0})
          </button>
          <button 
            onClick={() => setPriorityFilter('low')} 
            className={`text-xs px-3 py-1 rounded-full ${priorityFilter === 'low' ? 'bg-green-500 text-white' : 'text-gray-400'}`}
          >
            Low ({priorityCounts.low || 0})
          </button>
        </div>
      )}
      
      <div className="flex-1 relative overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-t-2 border-b-2 border-blue-400 rounded-full animate-spin"></div>
          </div>
        ) : isAuthError ? (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <FaGoogle className="text-red-500 mb-2" size={24} />
            <p className="text-gray-300 text-sm font-medium mb-2">Gmail Access Required</p>
            <p className="text-gray-400 text-xs mb-4">
              {isGoogleUser
                ? "We need permission to access your Gmail to display and prioritize your emails."
                : "This component needs access to your Gmail account to display and prioritize your emails."}
            </p>
            <button 
              onClick={handleGoogleAuth}
              className="flex items-center bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded"
            >
              <FaGoogle className="mr-2" />
              {isGoogleUser
                ? "Grant Gmail Access"
                : "Connect Gmail Account"}
            </button>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <FaExclamationCircle className="text-red-500 mb-2" size={24} />
            <p className="text-gray-400 text-sm">{error}</p>
            <button 
              onClick={fetchEmails}
              className="mt-3 bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-1 rounded"
            >
              Try Again
            </button>
          </div>
        ) : filteredEmails.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-sm">No emails found</p>
          </div>
        ) : (
          <div className="absolute inset-0 overflow-y-auto events-scroll">
            {filteredEmails.map(email => (
              <EmailRow key={email.id} email={email} />
            ))}
            
            {/* Fade overlay */}
            <div 
              className="sticky bottom-0 left-0 right-0 h-24 pointer-events-none" 
              style={{
                background: 'linear-gradient(to bottom, rgba(18, 18, 18, 0), rgba(18, 18, 18, 1) 85%)'
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default GmailOverview;
