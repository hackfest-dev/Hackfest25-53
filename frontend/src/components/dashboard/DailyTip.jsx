import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

const DailyTip = () => {
  const [tip, setTip] = useState(null);
  const [tipType, setTipType] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDailyTip = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Fetching intelligent daily tip...');
      
      // Fetch tip from backend
      const response = await api.get('/ai/daily-tip');
      setTip(response.data.tip);
      setTipType(response.data.tipType || 'general');
      console.log('Daily tip received:', response.data);
    } catch (err) {
      console.error('Error fetching daily tip:', err);
      setError('Failed to fetch today\'s tip. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDailyTip();
  }, [fetchDailyTip]);

  // Icon based on tip type
  const renderIcon = () => {
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
          <span className="text-gray-400 text-sm">Generating your daily insight...</span>
        </div>
      </div>
    );
  }

  if (error) {
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
          <h3 className="text-md font-semibold text-gray-100">Today's Insight</h3>
          {renderIcon()}
        </div>
        <button 
          onClick={fetchDailyTip}
          className="text-xs text-indigo-400 hover:text-indigo-300"
        >
          Refresh
        </button>
      </div>
      {tip && (
        <div className="text-sm text-gray-300">
          {tip}
        </div>
      )}
    </div>
  );
};

export default DailyTip;
