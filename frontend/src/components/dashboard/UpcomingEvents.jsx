import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import api from '../../services/api';
import { getGoogleToken } from '../../services/firebase';

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
      // First, check if we have a Google token already
      const googleToken = getGoogleToken();
      if (googleToken) {
        // Try to reuse the token
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
          // Fall back to opening auth URL
          window.open(authUrl, '_blank');
          // Check for auth status after a delay
          setTimeout(() => {
            fetchEvents();
          }, 5000);
        });
      } else {
        // Open auth URL as before
        window.open(authUrl, '_blank');
        // Check for auth status after a delay
        setTimeout(() => {
          fetchEvents();
        }, 5000);
      }
    }
  };

  if (loading) {
    return (
      <div className="p-4 h-full flex justify-center items-center">
        <div className="w-8 h-8 border-t-2 border-b-2 border-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error && authUrl) {
    return (
      <div className="p-6 text-center">
        <p className="text-amber-400 mb-4">Calendar access needed</p>
        <button 
          onClick={handleAuthorize}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          Connect Google Calendar
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-400">
        <p>{error}</p>
        <button 
          onClick={fetchEvents} 
          className="mt-2 text-sm text-indigo-400 hover:text-indigo-300"
        >
          Try again
        </button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="p-6 text-center text-gray-400">
        <p>No upcoming events in the next 7 days</p>
      </div>
    );
  }

  const formatEventTime = (event) => {
    if (event.start.dateTime) {
      // This is a timed event
      const startDate = parseISO(event.start.dateTime);
      const endDate = parseISO(event.end.dateTime);
      
      const startTime = format(startDate, 'h:mm a');
      const endTime = format(endDate, 'h:mm a');
      const day = format(startDate, 'EEE, MMM d');
      
      return `${day} · ${startTime} - ${endTime}`;
    } else {
      // This is an all-day event
      const date = parseISO(event.start.date);
      return `${format(date, 'EEE, MMM d')} · All day`;
    }
  };

  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-100">Upcoming Events</h2>
        <button 
          onClick={fetchEvents}
          className="text-sm text-indigo-400 hover:text-indigo-300"
        >
          Refresh
        </button>
      </div>
      <div className="space-y-3">
        {events.map((event) => (
          <div key={event.id} className="bg-[#1A1A1A] p-3 rounded-lg">
            <div className="flex justify-between items-start">
              <h3 className="font-medium text-gray-200">{event.summary}</h3>
              {event.htmlLink && (
                <a 
                  href={event.htmlLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-400 hover:text-indigo-300"
                >
                  View
                </a>
              )}
            </div>
            <p className="text-sm text-gray-400 mt-1">{formatEventTime(event)}</p>
            {event.description && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{event.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default UpcomingEvents;
