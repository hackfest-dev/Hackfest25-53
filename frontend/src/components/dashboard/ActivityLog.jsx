import React from 'react';
import { FaChrome, FaFirefox, FaWindows, FaCode, FaRegWindowMaximize } from 'react-icons/fa';

const ActivityLog = ({ data }) => {
  // Sort activities by timestamp (most recent first) but don't limit to 5
  const sortedActivities = [...data]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
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
    <div className="bg-[#121212] text-gray-300 relative rounded-lg overflow-hidden"
    style={{
      border: '0.5px solid #4B5563',
    }}>
      <div className="text-gray-300 text-sm font-medium pb-2 px-4 pt-3 bg-[#1C1B23] rounded-t-lg">ACTIVITY</div>
      <div className="flex items-center mb-4 px-4 pt-4">
        <div className="text-gray-500 mr-4">Desktop application:</div>
        <div className="text-gray-400">Ok</div>
      </div>
      
      <div className="space-y-2 px-4 max-h-[300px] overflow-hidden relative pb-4" 
           style={{
             maskImage: 'linear-gradient(to bottom, #121212 40%, transparent 100%)',
             WebkitMaskImage: 'linear-gradient(to bottom, #121212 40%, transparent 100%)'
           }}>
        {sortedActivities.map((activity, index) => (
          <div 
            key={index} 
            className="grid grid-cols-[100px_150px_1fr] items-center"
          >
            <div className="text-gray-500">
              {formatTime(activity.timestamp)}
            </div>
            <div className="text-gray-300">
              {activity.app_name}
            </div>
            <div className="text-gray-500 whitespace-nowrap overflow-hidden text-overflow-ellipsis" title={activity.window_title}>
              {truncateTitle(activity.window_title)}
            </div>
          </div>
        ))}
        
        {sortedActivities.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No recent activity data available
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityLog;
