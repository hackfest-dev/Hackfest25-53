import React, { useMemo, useRef, useEffect, useState } from 'react';

// Current time indicator as a separate component to avoid re-renders
const CurrentTimeIndicator = React.memo(({ hour, currentHour, currentMinute }) => {
  if (hour !== currentHour) return null;
  
  return (
<div 
  className="absolute top-0 bottom-0 w-[2px] z-20"
  style={{
    left: `${(currentMinute / 60) * 100}%`,
    background: 'linear-gradient(to bottom, rgba(76, 61, 139, 1), rgba(94, 78, 153, 1))'
  }}
></div>

  );
});

// Create a circular progress component for category visualization
const CategoryProgressCircle = React.memo(({ percentage, color }) => {
  // Calculate the stroke-dasharray and stroke-dashoffset for the circle
  const radius = 16; // Increased from 12
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (percentage / 100) * circumference;
  
  return (
    <svg width="64" height="" viewBox="0 0 40 40" className="mr-2"> {/* Increased from 32x32 */}
      {/* Background circle */}
      <circle 
        cx="20" 
        cy="20" 
        r={radius} 
        stroke="#2A2A2A" 
        strokeWidth="4" 
        fill="none" 
      />
      {/* Foreground circle showing percentage */}
      <circle 
        cx="20" 
        cy="20" 
        r={radius} 
        stroke={color} 
        strokeWidth="4" 
        fill="none" 
        strokeLinecap="round" 
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        transform="rotate(-90 20 20)"
      />
    </svg>
  );
});

const TimeTrackingCard = ({ data, isTracking, onToggleTracking }) => {
  const scrollContainerRef = useRef(null);
  const [currentHour, setCurrentHour] = useState(new Date().getHours());
  const [currentMinute, setCurrentMinute] = useState(new Date().getMinutes());
  
  // Generate hours for the timeline (all 24 hours)
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  // Calculate total time stats
  const stats = useMemo(() => {
    // Calculate total minutes (each entry represents 5 minutes in this sample data)
    const totalMinutes = data.length * 5;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return { hours, minutes };
  }, [data]);
  
  // Add data validation
  const isValidData = Array.isArray(data) && data.length > 0;
  
  // Group data by hour with minute-level detail
  const groupedByHour = hours.map(hour => {
    // Skip processing if no valid data
    if (!isValidData) {
      return { hour, minuteActivities: new Array(60).fill(false) };
    }
    
    // Create an array of 60 elements representing each minute in the hour
    const minuteActivities = new Array(60).fill(false);
    
    // Mark which minutes had activities
    data.forEach(item => {
      try {
        if (!item.timestamp) return;
        
        // Parse timestamp correctly
        const timestamp = new Date(item.timestamp);
        if (isNaN(timestamp.getTime())) {
          console.warn('Invalid timestamp:', item.timestamp);
          return;
        }
        
        // Check if this activity falls within the current hour
        if (timestamp.getHours() === hour) {
          const minute = timestamp.getMinutes();
          minuteActivities[minute] = true;
        }
      } catch (error) {
        console.error('Error processing activity item:', error, item);
      }
    });
    
    return {
      hour,
      minuteActivities,
      hasActivities: minuteActivities.some(active => active)
    };
  });
  
  // Update current time every minute
  useEffect(() => {
    if (!isValidData) {
      console.warn('TimeTrackingCard: No valid data received', data);
    }
    
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentHour(now.getHours());
      setCurrentMinute(now.getMinutes());
    }, 60000);
    
    return () => clearInterval(timer);
  }, [data, isValidData]);
  
  // Scroll to current hour on component mount or when current hour changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      const containerWidth = scrollContainerRef.current.clientWidth;
      const hourWidth = 60; // Fixed width for each hour cell
      
      // Calculate scrollLeft to center current hour
      const scrollPosition = (currentHour * hourWidth) - (containerWidth / 2) + (hourWidth / 2);
      
      scrollContainerRef.current.scrollLeft = Math.max(0, scrollPosition);
    }
  }, [currentHour]);

  // Custom scrollbar styles
  const scrollbarStyles = `
    .timeline-scroll::-webkit-scrollbar {
      height: 4px;
      background: #121212;
    }
    
    .timeline-scroll::-webkit-scrollbar-thumb {
      background: rgba(90, 90, 90, 0.4);
      border-radius: 4px;
    }
    
    .timeline-scroll::-webkit-scrollbar-thumb:hover {
      background: rgba(120, 120, 120, 0.6);
    }
    
    .timeline-scroll::-webkit-scrollbar-track {
      background: #1a1a1a;
      border-radius: 4px;
    }
    
    /* For Firefox */
    .timeline-scroll {
      scrollbar-width: thin;
      scrollbar-color: rgba(90, 90, 90, 0.4) #121212;
    }
  `;

  // Calculate top 5 categories by time spent
  const topCategories = useMemo(() => {
    if (!isValidData) return [];
    
    // Count activities by category (assuming each activity is 5 minutes)
    const categoryCount = data.reduce((acc, item) => {
      const category = item.category || 'Uncategorized';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});
    
    // Convert to array and sort by count (highest first)
    const sortedCategories = Object.entries(categoryCount)
      .map(([name, count]) => ({
        name,
        count,
        minutes: count * 5, // Each entry is 5 minutes
        percentage: Math.round((count / data.length) * 100)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Take top 5
      
    // Generate colors for each category (using purple theme)
    const purpleColors = [
      'rgba(149, 128, 255, 0.9)',
      'rgba(128, 90, 213, 0.9)',
      'rgba(168, 130, 255, 0.9)',
      'rgba(106, 90, 205, 0.9)',
      'rgba(138, 118, 223, 0.9)',
    ];
    
    return sortedCategories.map((category, index) => ({
      ...category,
      color: purpleColors[index % purpleColors.length]
    }));
  }, [data, isValidData]);
  
  return (
    <div className="flex flex-col w-full bg-[#121212] rounded-lg overflow-hidden h-full"
      style={{
        border: '0.5px solid #4B5563',
      }}>
      {/* Include custom scrollbar styles */}
      <style>{scrollbarStyles}</style>
      
      <div className="text-gray-300 text-sm font-medium pb-2 px-4 pt-3 bg-[#1C1B23]">WORK HOURS</div>
      
      {/* Total time display */}
      {/* <div className="flex flex-col items-center justify-center px-4 py-2 bg-[#121212] border-b border-gray-800">
        <div className="text-sm text-gray-400 mb-1">Total time worked</div>
        <div className="text-3xl font-bold mb-1">{stats.hours}h {stats.minutes}m</div>
      </div> */}
      
      {/* Top 5 Categories by Time Spent - Horizontal Layout */}
      <div className="bg-[#121212] px-4 py-2 border-b border-gray-800">
        {/* <div className="text-xs text-gray-400 mb-2">TOP CATEGORIES BY TIME</div> */}
        
        <div className="flex w-full justify-between mb-10 mt-10">
          {topCategories.length > 0 ? (
            topCategories.map((category, index) => (
              <div key={index} className="flex flex-row items-center">
                <CategoryProgressCircle 
                  percentage={category.percentage} 
                  color={category.color} 
                />
                <div className="flex flex-col items-center mt-1">
                  <span className="text-xs text-gray-300 truncate w-full text-center" title={category.name}>
                    {category.name}
                  </span>
                  <span className="text-xs text-gray-500 text-center">
                    {category.percentage}%
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-gray-500 text-center py-2 w-full">
              No category data available
            </div>
          )}
        </div>
      </div>
      
      {/* Timeline visualization */}
      <div className="flex-1 flex flex-col">
        <div 
          ref={scrollContainerRef}
          className="relative overflow-x-auto timeline-scroll flex-1"
          style={{ scrollBehavior: 'smooth' }}
        >
          <div className="inline-block min-w-max">
            {/* Timeline grid */}
            <div className="flex h-[110px]">
              {hours.map((hour, index) => (
                <div 
                  key={hour} 
                  className={`w-[60px] border-t border-l border-r border-gray-700 relative ${
                    index === 0 ? 'border-l-0' : ''
                  } ${index === hours.length - 1 ? 'rounded-tr-lg border-l-0' : ''}`}
                  style={{ flexShrink: 0 }}
                >
                  {/* Minute-level activity blocks */}
                  {groupedByHour[index].minuteActivities.map((isActive, minute) => (
                    isActive && (
                      <div 
                        key={minute}
                        className="absolute h-full"
                        style={{
                          left: `${(minute / 60) * 100}%`,
                          width: `${(1 / 60) * 100}%`,
                          background: 'linear-gradient(to bottom, rgba(76, 61, 139, 1), rgba(94, 78, 153, 1))'
                        }}
                      ></div>
                    )
                  ))}
                  
                  {/* Current time indicator */}
                  <CurrentTimeIndicator 
                    hour={hour} 
                    currentHour={currentHour}
                    currentMinute={currentMinute}
                  />
                </div>
              ))}
            </div>
            
            {/* Hour markers */}
            <div className="flex border-b border-gray-700">
              {hours.map((hour, index) => (
                <div 
                  key={hour} 
                  className={`w-[60px] text-center text-xs text-gray-400 py-1 ${
                    index === 0 ? 'rounded-bl-lg' : ''
                  } ${index === hours.length - 1 ? 'rounded-br-lg' : ''}`}
                  style={{ flexShrink: 0 }}
                >
                  {hour === 0 ? '0:00' : 
                   hour < 10 ? `${hour}:00` : 
                   `${hour}:00`}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimeTrackingCard;
