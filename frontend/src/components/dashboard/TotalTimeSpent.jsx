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
        borderBottom: '0.5px solid #4B5563',
      }}>
      <div className="text-gray-300 text-sm font-medium pb-2 px-4 pt-3 bg-[#1C1B23]">WORK HOURS</div>
      
      <div className="flex flex-col items-center justify-center flex-grow px-2 py-2">
        <div className="text-sm text-gray-400 mb-2">Total time worked</div>
        <div className="text-4xl font-bold mb-4">{stats.hours}h {stats.minutes}m</div>
        
   {/* Tracking status and control */}
<div className="w-full bg-black text-gray-400 p-2 py-1 rounded flex justify-between items-center">
  <div className="flex flex-col">
    <div className="flex items-center">
      <span>Tracking:</span>
      <span className="ml-1 text-gray-300">On</span>
    </div>
  </div>
  
  <button 
    onClick={onToggleTracking}
    className="px-3 py-1 rounded-full bg-[#3A3A47] text-white hover:bg-[#45455A] transition-colors text-xs"
  >
    Disable Tracking
  </button>
</div>

      </div>
    </div>
  );
};

export default TotalTimeSpent;
