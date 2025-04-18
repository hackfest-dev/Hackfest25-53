import React, { useMemo } from 'react';

const TotalTimeSpent = ({ data, isTracking, onToggleTracking }) => {
  const stats = useMemo(() => {
    // Calculate total minutes (each entry represents 5 minutes in this sample data)
    const totalMinutes = data.length * 5;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return { hours, minutes };
  }, [data]);
  
  return (
    <div className="flex flex-col w-full bg-[#121212] rounded-lg overflow-hidden h-full"
      style={{
        border: '0.5px solid #4B5563',
        borderBottom: 'none',
      }}>
      <div className="text-gray-300 text-sm font-medium pb-2 px-4 pt-3 bg-[#1C1B23]">WORK HOURS</div>
      
      <div className="flex flex-col items-center justify-center flex-grow px-4 py-6">
        <div className="text-sm text-gray-400 mb-2">Total time worked</div>
        <div className="text-4xl font-bold mb-4">{stats.hours}h {stats.minutes}m</div>
        
        {/* Tracking status and control */}
        <div className="w-full mt-4 flex flex-col items-center">
          <div className={`flex items-center ${isTracking ? 'text-green-500' : 'text-red-500'} mb-2`}>
            <div className={`w-2 h-2 rounded-full mr-2 ${isTracking ? 'bg-green-500' : 'bg-red-500'}`}></div>
            Tracking: {isTracking ? 'ON' : 'OFF'}
          </div>
          
          <button 
            onClick={onToggleTracking}
            className={`px-4 py-2 rounded text-sm w-full ${
              isTracking 
                ? 'bg-red-700 text-white hover:bg-red-600' 
                : 'bg-green-700 text-white hover:bg-green-600'
            }`}
          >
            {isTracking ? 'Disable Tracking' : 'Enable Tracking'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TotalTimeSpent;
