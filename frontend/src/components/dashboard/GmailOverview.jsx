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
  
  return (
    <div className={`flex items-center border-b border-gray-700 p-2 hover:bg-gray-800 transition-colors ${email.priority === 'high' ? 'bg-gray-800' : ''}`}>
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
  
  useEffect(() => {
    const checkGoogleAuth = async () => {
      try {
        const userInfo = await gmailService.checkGoogleAuth();
        console.log("Gmail auth check result:", userInfo);
        setIsGoogleUser(!!userInfo);
        setAuthChecked(true);
        
        if (userInfo) {
          fetchEmails();
        }
      } catch (error) {
        console.error('Error checking Google auth:', error);
        setIsGoogleUser(false);
        setAuthChecked(true);
      }
    };
    
    checkGoogleAuth();
  }, []);
  
  const handleGoogleAuth = async () => {
    try {
      if (isGoogleUser) {
        await gmailService.refreshGoogleToken();
        fetchEmails();
        return;
      }
      
      // Get auth URL first
      const authUrl = await gmailService.getAuthUrl();
      
      if (!authUrl) {
        setError('Failed to get authorization URL');
        return;
      }
      
      // Then open the window with the auth URL
      const authWindow = window.open(authUrl, '_blank', 'width=500,height=600');
      
      setLoading(true);
      setError(null);
      setIsAuthError(false);
      
      // Check periodically if the auth window was closed
      const checkAuthInterval = setInterval(() => {
        if (authWindow && authWindow.closed) {
          clearInterval(checkAuthInterval);
          setTimeout(async () => {
            // Check if the authentication was successful
            const userInfo = await gmailService.checkGoogleAuth();
            if (userInfo) {
              setIsGoogleUser(true);
              fetchEmails();
            } else {
              setError('Gmail authorization failed or was cancelled');
              setIsAuthError(true);
              setLoading(false);
            }
          }, 1000);
        }
      }, 1000);
    } catch (error) {
      console.error('Error initiating Google auth:', error);
      setError('Failed to initiate Google authorization');
    }
  };
  
  const fetchEmails = async () => {
    try {
      setLoading(true);
      setError(null);
      setIsAuthError(false);
      
      const response = await gmailService.getEmails(100);
      
      if (response.success) {
        setEmails(response.emails);
        setIsGoogleUser(true);
      } else {
        setError('Failed to fetch emails');
      }
    } catch (error) {
      console.error('Error fetching emails:', error);
      
      if (error.message && (
          error.message.includes('authorization required') || 
          error.message.includes('auth') || 
          error.message.includes('401') ||
          error.message.includes('403'))) {
        setIsAuthError(true);
        
        if (isGoogleUser) {
          setError('Gmail access required. Please click the button below to grant access to your Gmail.');
        } else {
          setError('Gmail authorization required. Please connect your Gmail account.');
        }
        
        setIsGoogleUser(false);
      } else {
        setError(error.message);
      }
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    if (authChecked && !isGoogleUser) {
      fetchEmails();
    }
  }, [authChecked, isGoogleUser]);
  
  const filteredEmails = priorityFilter === 'all' 
    ? emails 
    : emails.filter(email => email.priority === priorityFilter);
  
  const priorityCounts = emails.reduce((counts, email) => {
    counts[email.priority] = (counts[email.priority] || 0) + 1;
    return counts;
  }, {});
  
  return (
    <div className="bg-[#121212] rounded-lg shadow-lg overflow-hidden h-full flex flex-col">
      <div className="p-4 border-b border-gray-700 flex justify-between items-center">
        <div className="flex items-center">
          <FaEnvelope className="text-blue-400 mr-2" />
          <h2 className="text-white text-lg font-medium">Gmail</h2>
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
      
      <div className="flex-1 overflow-y-auto">
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
          <div>
            {filteredEmails.map(email => (
              <EmailRow key={email.id} email={email} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GmailOverview;
