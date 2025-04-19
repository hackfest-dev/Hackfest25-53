import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';

const DailyTip = () => {
  const [tips, setTips] = useState([]);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const autoSlideInterval = useRef(null);

  const fetchDailyTip = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Fetching intelligent daily tips...');
      
      // First ensure calendar access is available
      try {
        console.log('Checking calendar access...');
        const calendarCheck = await api.get('/calendar/events');
        console.log('Calendar access check result:', calendarCheck.data);
        
        if (calendarCheck.data.events) {
          console.log('Calendar events available:', calendarCheck.data.events.length);
        }
      } catch (calendarError) {
        // If we get an auth URL, we need to authenticate
        if (calendarError.response?.data?.authUrl) {
          console.warn('Calendar needs authentication. Auth URL:', calendarError.response.data.authUrl);
          // You could open this URL in a new tab or show a prompt to the user
          // window.open(calendarError.response.data.authUrl, '_blank');
        } else {
          console.warn('Calendar access check failed:', calendarError);
        }
        // Continue anyway - the backend will use mock calendar data
      }
      
      // Ensure we have an auth token
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('No auth token found for calendar access');
      } else {
        // Make sure the token is set in the API service
        api.setAuthToken(token);
      }
      
      // First get user location
      let location;
      try {
        location = await api.getUserLocation();
        console.log('User location:', location);
      } catch (locationError) {
        console.warn('Error getting location, using default:', locationError);
        location = 'New York';
      }
      
      // Fetch tip from backend with location
      const response = await api.get(`/ai/daily-tip?location=${encodeURIComponent(location)}`, {
        timeout: 15000 // 15 second timeout
      });
      
      console.log('Raw API response:', response.data);
      
      if (response.data.tips && Array.isArray(response.data.tips)) {
        // Ensure we have at least 2 tips and at most 4
        if (response.data.tips.length === 0) {
          throw new Error('No tips received from server');
        } else if (response.data.tips.length === 1) {
          // If only one tip, duplicate it with a different type to ensure slider works
          setTips([
            response.data.tips[0],
            {
              tip: "Take regular breaks to maintain productivity throughout your workday.",
              tipType: "productivity"
            }
          ]);
        } else {
          setTips(response.data.tips.slice(0, 4));
        }
        console.log('Daily tips received:', response.data.tips);
      } else if (response.data.tip) {
        // Handle legacy response format with single tip
        setTips([
          {
            tip: response.data.tip,
            tipType: response.data.tipType || 'general'
          },
          {
            tip: "Try the Pomodoro Technique: 25 minutes of focused work followed by a 5-minute break.",
            tipType: "productivity"
          }
        ]);
      } else {
        throw new Error('Invalid tip format received');
      }
    } catch (err) {
      console.error('Error fetching daily tips:', err);
      setError('Failed to fetch today\'s tips. Please try again later.');
      
      // Check if we already have tips - if so, keep them instead of providing fallback
      if (tips.length === 0) {
        // Provide fallback tips
        setTips([
          {
            tip: "Plan your day by prioritizing important tasks and scheduling breaks to maintain productivity.",
            tipType: "productivity"
          },
          {
            tip: "Regularly review your calendar to stay ahead of upcoming meetings and deadlines.",
            tipType: "meeting"
          }
        ]);
      }
    } finally {
      setLoading(false);
    }
  }, [tips.length]);

  // Start auto slide when tips are loaded
  useEffect(() => {
    if (tips.length > 1) {
      startAutoSlide();
    }
    
    return () => {
      if (autoSlideInterval.current) {
        clearInterval(autoSlideInterval.current);
      }
    };
  }, [tips]);

  // Start auto sliding tips
  const startAutoSlide = () => {
    if (autoSlideInterval.current) {
      clearInterval(autoSlideInterval.current);
    }
    
    autoSlideInterval.current = setInterval(() => {
      setCurrentTipIndex(prevIndex => (prevIndex + 1) % tips.length);
    }, 7000); // Change slide every 7 seconds
  };

  // Navigate to specific tip
  const goToTip = (index) => {
    setCurrentTipIndex(index);
    
    // Reset auto slide timer
    if (autoSlideInterval.current) {
      clearInterval(autoSlideInterval.current);
    }
    startAutoSlide();
  };

  useEffect(() => {
    fetchDailyTip();
  }, [fetchDailyTip]);

  // Icon based on tip type
  const renderIcon = (tipType) => {
    switch (tipType) {
      case 'weather':
        return (
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
          </svg>
        );
      case 'meeting':
        return (
          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'productivity':
        return (
          <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  if (loading) {
    return (
      <div className="bg-[#121212] rounded-lg shadow-lg p-4 flex items-center justify-center h-24">
        <div className="flex items-center space-x-3">
          <div className="w-6 h-6 border-t-2 border-b-2 border-indigo-500 rounded-full animate-spin"></div>
          <span className="text-gray-400 text-sm">Generating your daily insights...</span>
        </div>
      </div>
    );
  }

  if (error && tips.length === 0) {
    return (
      <div className="bg-[#121212] rounded-lg shadow-lg p-4 h-24">
        <div className="text-red-400 text-sm">{error}</div>
        <button 
          onClick={fetchDailyTip}
          className="mt-2 text-xs text-indigo-400 hover:text-indigo-300"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-[#121212] to-[#1a1a1a] rounded-lg shadow-lg p-4">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center space-x-2">
          <h3 className="text-md font-semibold text-gray-100">Today's Insights</h3>
          {tips.length > 0 && tips[currentTipIndex] && renderIcon(tips[currentTipIndex].tipType || 'general')}
        </div>
        <button 
          onClick={fetchDailyTip}
          className="text-xs text-indigo-400 hover:text-indigo-300"
        >
          Refresh
        </button>
      </div>
      
      {tips.length > 0 && tips[currentTipIndex] ? (
        <div className="text-sm text-gray-300 min-h-[60px]">
          {tips[currentTipIndex].tip || "No tip content available"}
        </div>
      ) : (
        <div className="text-sm text-gray-400 min-h-[60px]">
          No tips available at the moment.
        </div>
      )}
      
      {/* Tip pagination dots */}
      {tips.length > 1 && (
        <div className="flex justify-center mt-3 space-x-2">
          {tips.map((_, index) => (
            <button 
              key={index}
              onClick={() => goToTip(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentTipIndex 
                  ? 'bg-indigo-400 w-4' 
                  : 'bg-gray-600 hover:bg-gray-500'
              }`}
              aria-label={`Go to tip ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default DailyTip;
