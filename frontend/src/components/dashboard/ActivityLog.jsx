import React from 'react';
import { FaChrome, FaFirefox, FaWindows, FaCode, FaRegWindowMaximize } from 'react-icons/fa';

const ActivityLog = ({ data }) => {
  // Get the most recent 5 activities
  const recentActivities = [...data]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 5);
  
  const getAppIcon = (appName) => {
    const lcApp = appName.toLowerCase();
    if (lcApp.includes('chrome')) return <FaChrome className="text-blue-400" />;
    if (lcApp.includes('firefox')) return <FaFirefox className="text-orange-500" />;
    if (lcApp.includes('code')) return <FaCode className="text-blue-600" />;
    if (lcApp.includes('terminal') || lcApp.includes('powershell')) 
      return <FaWindows className="text-blue-300" />;
    return <FaRegWindowMaximize className="text-gray-400" />;
  };
  
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: false 
    });
  };
  
  const truncateTitle = (title, maxLength = 30) => {
    return title.length > maxLength 
      ? title.substring(0, maxLength) + '...' 
      : title;
  };
  
  return (
    <div className="space-y-3">
      {recentActivities.map((activity, index) => (
        <div 
          key={index} 
          className="flex items-center p-3 bg-gray-700/30 rounded-lg transition-all hover:bg-gray-700/50"
        >
          <div className="mr-3 p-2 bg-gray-700/50 rounded text-xl">
            {getAppIcon(activity.app_name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">{activity.app_name}</div>
            <div className="text-xs text-gray-400 truncate" title={activity.window_title}>
              {truncateTitle(activity.window_title)}
            </div>
          </div>
          <div className="text-xs text-gray-400 whitespace-nowrap">
            {formatTime(activity.timestamp)}
          </div>
        </div>
      ))}
      
      {recentActivities.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No recent activity data available
        </div>
      )}
    </div>
  );
};

export default ActivityLog;
