import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import api from '../../services/api';
import { getGoogleToken } from '../../services/firebase';
import { FaCalendarAlt, FaClock, FaExternalLinkAlt, FaSync } from 'react-icons/fa';

const UpcomingEvents = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [authUrl, setAuthUrl] = useState(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await api.get('/calendar/events');
      setEvents(response.data.events || []);
      setError(null);
      setAuthUrl(null);
    } catch (err) {
      console.error('Error fetching calendar events:', err);
      if (err.response?.data?.authUrl) {
        setAuthUrl(err.response.data.authUrl);
      }
      setError(err.response?.data?.error || 'Failed to fetch calendar events');
    } finally {
      setLoading(false);
    }
  };

  const handleAuthorize = () => {
    if (authUrl) {
      const googleToken = getGoogleToken();
      if (googleToken) {
        api.post('/calendar/set-google-token', {
          googleToken,
          userInfo: {
            sub: api.getDecodedToken()?.uid || '',
            email: api.getDecodedToken()?.email || ''
          }
        })
        .then(() => {
          console.log('Reused existing Google token');
          fetchEvents();
        })
        .catch(err => {
          console.error('Error reusing token:', err);
          window.open(authUrl, '_blank');
          setTimeout(() => {
            fetchEvents();
          }, 5000);
        });
      } else {
        window.open(authUrl, '_blank');
        setTimeout(() => {
          fetchEvents();
        }, 5000);
      }
    }
  };

  const formatEventDate = (event) => {
    if (event.start.dateTime) {
      const startDate = parseISO(event.start.dateTime);
      return format(startDate, 'EEE, MMM d');
    } else {
      const date = parseISO(event.start.date);
      return format(date, 'EEE, MMM d');
    }
  };

  const formatEventTime = (event) => {
    if (event.start.dateTime) {
      const startDate = parseISO(event.start.dateTime);
      const endDate = parseISO(event.end.dateTime);
      
      const startTime = format(startDate, 'HH:mm');
      const endTime = format(endDate, 'HH:mm');
      
      return `${startTime} - ${endTime}`;
    } else {
      return 'All day';
    }
  };

  // Custom scrollbar styles
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
    <div className="bg-[#121212] text-gray-300 relative rounded-lg overflow-hidden h-full flex flex-col"
    style={{
      border: '0.5px solid #4B5563',
    }}>
      <style>{scrollbarStyles}</style>
      
      {/* Header */}
      <div className="text-gray-300 text-sm font-medium pb-2 px-4 pt-3 bg-[#1C1B23] rounded-t-lg flex justify-between items-center">
        <span>UPCOMING EVENTS</span>
        {!loading && !error && events.length > 0 && (
          <button 
            onClick={fetchEvents}
            className="text-xs text-gray-400 hover:text-gray-300 flex items-center"
          >
            <FaSync className="mr-1 text-xs" />
            Refresh
          </button>
        )}
      </div>
      
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="p-4 h-full flex justify-center items-center">
            <div className="w-8 h-8 border-t-2 border-b-2 border-[#5D4C99] rounded-full animate-spin"></div>
          </div>
        ) : error && authUrl ? (
          <div className="p-6 text-center">
            <p className="text-gray-400 mb-4">Calendar access needed</p>
            <button 
              onClick={handleAuthorize}
              className="px-4 py-2 bg-[#4A3C7F] text-white rounded-md hover:bg-[#5D4C99] transition-colors"
            >
              Connect Google Calendar
            </button>
          </div>
        ) : error ? (
          <div className="p-4 text-gray-400 flex flex-col items-center justify-center h-full">
            <p>{error}</p>
            <button 
              onClick={fetchEvents} 
              className="mt-4 px-3 py-1 bg-[#1A1A1A] border border-[#4A3C7F] rounded-md text-sm text-gray-300 hover:bg-[#2A2A2A] transition-colors"
            >
              Try again
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="p-6 text-center text-gray-400 flex flex-col items-center justify-center h-full">
            <FaCalendarAlt className="text-3xl mb-3 text-gray-500" />
            <p>No upcoming events in the next 7 days</p>
          </div>
        ) : (
          <div className="flex flex-col h-full relative">
            <div className="px-4 py-2 text-xs text-gray-500">
              Next 7 days
            </div>
            
            <div className="relative flex-1 overflow-hidden">
              {/* Scrollable area with custom scrollbar */}
              <div className="absolute inset-0 overflow-y-auto events-scroll px-4 pb-4">
                <div className="space-y-3">
                  {events.map((event) => (
                    <div key={event.id} className="bg-[#1A1A1A] p-3 rounded-lg hover:bg-[#222222] transition-colors">
                      <div className="flex justify-between items-start">
                        <h3 className="font-medium text-gray-200 break-words pr-2">{event.summary}</h3>
                        {event.htmlLink && (
                          <a 
                            href={event.htmlLink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-[#5D4C99] hover:text-[#7E6CB9] flex-shrink-0"
                            aria-label="View in Google Calendar"
                          >
                            <FaExternalLinkAlt />
                          </a>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between text-sm text-gray-400 mt-2">
                        <div className="flex items-center">
                          <FaCalendarAlt className="mr-2 text-xs text-gray-500" />
                          <span>{formatEventDate(event)}</span>
                        </div>
                        <div className="flex items-center">
                          <FaClock className="mr-2 text-xs text-gray-600" />
                          <span className='text-xs text-gray-600'>{formatEventTime(event)}</span>
                        </div>
                      </div>
                      
                      {event.description && (
                        <p className="text-xs text-gray-500 mt-2 line-clamp-2 break-words border-t border-[#2A2A2A] pt-1">
                          {event.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Fade overlay */}
              <div 
                className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none" 
                style={{
                  background: 'linear-gradient(to bottom, rgba(18, 18, 18, 0), rgba(18, 18, 18, 1) 85%)'
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UpcomingEvents;
