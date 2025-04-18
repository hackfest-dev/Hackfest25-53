import React, { useRef, useEffect, useState } from 'react';

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

const TimelineBreakdown = ({ data }) => {
  const scrollContainerRef = useRef(null);
  const [currentHour, setCurrentHour] = useState(new Date().getHours());
  const [currentMinute, setCurrentMinute] = useState(new Date().getMinutes());
  
  // Generate hours for the timeline (all 24 hours)
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
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
  
  // For debugging
  useEffect(() => {
    if (!isValidData) {
      console.warn('TimelineBreakdown: No valid data received', data);
    } else {
      console.log('TimelineBreakdown: Data received', data.length, 'items');
      console.log('Grouped data:', groupedByHour.filter(g => g.hasActivities));
    }
    
    // Update current time every minute
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
  
  return (
    <div
      className="flex flex-col w-full bg-[#121212] rounded-lg overflow-hidden"
      style={{
        border: '0.5px solid #4B5563',
        borderBottom: 'none',
      }}
    >
      {/* Include custom scrollbar styles */}
      <style>{scrollbarStyles}</style>
      
      <div className="text-gray-300 text-sm font-medium pb-2 px-4 pt-3 bg-[#1C1B23]">TIMELINE</div>
      <div 
        ref={scrollContainerRef}
        className="relative overflow-x-auto timeline-scroll"
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
  );
};

// Apply strict equality check for props to prevent unnecessary re-renders
export default React.memo(TimelineBreakdown, (prevProps, nextProps) => {
  return prevProps.data === nextProps.data || 
         (Array.isArray(prevProps.data) && 
          Array.isArray(nextProps.data) && 
          JSON.stringify(prevProps.data) === JSON.stringify(nextProps.data));
});
