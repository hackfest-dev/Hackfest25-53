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
  
  // Custom scrollbar styles
  const scrollbarStyles = `
    .activity-scroll::-webkit-scrollbar {
      width: 4px;
      background: #121212;
    }
    
    .activity-scroll::-webkit-scrollbar-thumb {
      background: rgba(90, 90, 90, 0.4);
      border-radius: 4px;
    }
    
    .activity-scroll::-webkit-scrollbar-thumb:hover {
      background: rgba(120, 120, 120, 0.6);
    }
    
    .activity-scroll::-webkit-scrollbar-track {
      background: #1a1a1a;
      border-radius: 4px;
    }
    
    .activity-scroll {
      scrollbar-width: thin;
      scrollbar-color: rgba(90, 90, 90, 0.4) #121212;
    }
  `;
  
  return (
    <div className="bg-[#121212] text-gray-300 relative rounded-lg overflow-hidden h-full flex flex-col"
    style={{
      border: '0.5px solid #4B5563',
    }}>
      <style>{scrollbarStyles}</style>
      <div className="text-gray-300 text-sm font-medium pb-2 px-4 pt-3 bg-[#1C1B23] rounded-t-lg">ACTIVITY</div>
      <div className="flex items-center mb-2 px-4 pt-2">
        <div className="text-gray-500 mr-4">Desktop application:</div>
        <div className="text-gray-400">Ok</div>
      </div>
      
      {/* Container with fade effect */}
      <div className="flex-1 relative overflow-hidden">
        {/* Scrollable area with custom scrollbar */}
        <div className="absolute inset-0 overflow-y-auto activity-scroll px-4 pb-4">
          <div className="space-y-2">
            {sortedActivities.map((activity, index) => (
              <div 
                key={index} 
                className="grid grid-cols-[100px_150px_1fr] items-center"
              >
                <div className="text-gray-500">
                  {formatTime(activity.timestamp)}
                </div>
                <div className="text-gray-300 whitespace-nowrap overflow-hidden text-overflow-ellipsis" title={activity.app_name}>
                  {truncateTitle(activity.app_name, 15)}
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
        
        {/* Fade overlay */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none" 
          style={{
            background: 'linear-gradient(to bottom, transparent, #121212 90%)'
          }}
        />
      </div>
    </div>
  );
};

export default ActivityLog;
