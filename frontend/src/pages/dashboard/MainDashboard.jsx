import React, { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } from 'react';
import Navbar from '../../components/dashboard/Navbar';
import Sidebar from '../../components/dashboard/Sidebar';
import TimelineBreakdown from '../../components/dashboard/TimelineBreakdown';
import TotalTimeSpent from '../../components/dashboard/TotalTimeSpent';
import ActivityLog from '../../components/dashboard/ActivityLog';
import CategoryBreakdown from '../../components/dashboard/CategoryBreakdown';
import UpcomingEvents from '../../components/dashboard/UpcomingEvents';
import DailyTip from '../../components/dashboard/DailyTip';
import GmailOverview from '../../components/dashboard/GmailOverview';
import TimeTrackingCard from '../../components/dashboard/TimeTrackingCard';
import api from '../../services/api';

// Create a context to hold the activity data without causing re-renders
const ActivityDataContext = createContext(null);

// Loading indicator component
const LoadingIndicator = React.memo(() => (
  <div className="flex items-center justify-center h-full">
    <div className="w-12 h-12 border-t-2 border-b-2 border-indigo-500 rounded-full animate-spin"></div>
  </div>
));

// Status display component with refresh button and auto-refresh countdown
const StatusDisplay = React.memo(({ lastUpdated, isRefreshing, onRefresh, nextRefresh }) => (
  <div className="flex justify-between items-center text-xs text-gray-500">
    <div className="flex items-center space-x-4">
      {lastUpdated && (
        <div>Last updated: {lastUpdated}</div>
      )}
      {nextRefresh && (
        <div>Next refresh in: {nextRefresh}</div>
      )}
      {isRefreshing && (
        <div className="text-blue-400 flex items-center">
          <div className="w-3 h-3 border-t border-b border-blue-400 rounded-full animate-spin mr-2"></div>
          Refreshing...
        </div>
      )}
    </div>
    <button 
      onClick={onRefresh}
      disabled={isRefreshing}
      className={`px-3 py-1 rounded-full text-xs cursor-pointer ${
        isRefreshing 
          ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
          : 'bg-gray-700 text-white hover:bg-gray-600'
      }`}
    >
      Refresh Now
    </button>
  </div>
));

// Activity data provider component
const ActivityDataProvider = ({ children }) => {
  // Maintain refs for data to prevent re-renders
  const dataRef = useRef([]);
  const updateCountRef = useRef(0);
  
  // Add the missing ref declarations
  const autoRefreshIntervalRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  
  // We still need some state for UI updates, but minimize what triggers re-renders
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [nextRefreshTime, setNextRefreshTime] = useState(null);
  const [nextRefreshDisplay, setNextRefreshDisplay] = useState(null);
  const [isTracking, setIsTracking] = useState(true); // Default to tracking enabled
  
  // Disable development server hot reload on file changes
  useEffect(() => {
    // This disconnects the automatic file watcher in development mode
    if (import.meta.hot) {
      const originalHot = import.meta.hot;
      import.meta.hot = {
        ...originalHot,
        accept: () => {
          console.log('Automatic file reload disabled by the dashboard');
          return false;
        }
      };
      
      // Restore on unmount
      return () => {
        import.meta.hot = originalHot;
      };
    }
  }, []);
  
  // Update function that doesn't cause unnecessary re-renders
  const updateData = useCallback((newData) => {
    // Skip invalid data
    if (!Array.isArray(newData)) return;
    
    // Compare data to see if it changed
    if (dataRef.current.length !== newData.length || 
        JSON.stringify(dataRef.current) !== JSON.stringify(newData)) {
      console.log(`Data update #${updateCountRef.current + 1}: ${newData.length} entries`);
      dataRef.current = newData;
      updateCountRef.current++;
      setLastUpdated(new Date().toLocaleTimeString());
      
      // Only update loading state if necessary
      if (isInitialLoading) {
        setIsInitialLoading(false);
      }
    } else {
      console.log('Data unchanged, skipping update');
    }
    
    setIsRefreshing(false);
    
    // Set next refresh time to 5 minutes from now
    const nextTime = new Date();
    nextTime.setMinutes(nextTime.getMinutes() + 5);
    setNextRefreshTime(nextTime);
  }, [isInitialLoading]);

  // Update countdown display
  const updateCountdown = useCallback(() => {
    if (!nextRefreshTime) return;
    
    const now = new Date();
    const diffMs = nextRefreshTime - now;
    
    if (diffMs <= 0) {
      setNextRefreshDisplay("Refreshing soon...");
      return;
    }
    
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.floor((diffMs % 60000) / 1000);
    setNextRefreshDisplay(`${diffMins}m ${diffSecs}s`);
  }, [nextRefreshTime]);

  // Fetch data function for manual refresh
  const fetchData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      console.log('Fetching activity data...');
      
      // Create a trigger file for the backend to refresh the data immediately
      try {
        await fetch('/refresh_trigger.txt', { 
          method: 'POST', 
          body: Date.now().toString(),
          headers: { 'Content-Type': 'text/plain' }
        });
        console.log('Refresh trigger sent to backend');
      } catch (err) {
        console.warn('Failed to send refresh trigger to backend:', err);
      }
      
      // Wait a moment for the backend to process the data
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Now fetch the latest data with cache-busting
      const timestamp = Date.now();
      const url = `/categorized_log.json?nocache=${timestamp}`;
      
      const response = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      
      const data = await response.json();
      updateData(data);
    } catch (error) {
      console.error('Error fetching data:', error);
      setIsRefreshing(false);
      if (isInitialLoading) {
        setIsInitialLoading(false);
      }
    }
  }, [updateData, isInitialLoading]);
  
  // Handle manual refresh - expose this to the UI
  const handleRefresh = useCallback(() => {
    if (!isRefreshing) {
      fetchData();
      
      // Reset the auto-refresh timer whenever manual refresh happens
      const nextTime = new Date();
      nextTime.setMinutes(nextTime.getMinutes() + 5);
      setNextRefreshTime(nextTime);
    }
  }, [fetchData, isRefreshing]);
  
  // Toggle tracking function - simulate toggling for now
  const toggleTracking = useCallback(async () => {
    try {
      // Directly toggle the state since we don't have a backend API yet
      setIsTracking(!isTracking);
      console.log(`Tracking ${isTracking ? 'disabled' : 'enabled'}`);
      
      // This is a placeholder for real API call when backend is ready
      // Uncomment and use this code when you have the API server running
      /*
      const action = isTracking ? 'stop' : 'start';
      const response = await fetch(`/api/tracking/${action}`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      
      // Toggle state if successful
      setIsTracking(!isTracking);
      */
    } catch (error) {
      console.error('Error toggling tracking:', error);
    }
  }, [isTracking]);
  
  // Initial data fetch only
  useEffect(() => {
    console.log('Initial data fetch');
    fetchData();
  }, [fetchData]);
  
  // Setup auto-refresh every 5 minutes
  useEffect(() => {
    // Clear any existing interval
    if (autoRefreshIntervalRef.current) {
      clearInterval(autoRefreshIntervalRef.current);
    }
    
    // Set new interval - using explicit 5 minutes (300000 ms) to prevent any misinterpretation
    const FIVE_MINUTES_MS = 300000; // 5 minutes in milliseconds
    console.log(`Setting auto-refresh interval for ${FIVE_MINUTES_MS}ms (5 minutes)`);
    
    autoRefreshIntervalRef.current = setInterval(() => {
      console.log('Auto refresh triggered after 5 minutes');
      fetchData();
    }, FIVE_MINUTES_MS);
    
    // Set initial next refresh time
    const nextTime = new Date();
    nextTime.setMinutes(nextTime.getMinutes() + 5);
    setNextRefreshTime(nextTime);
    
    // Cleanup on unmount
    return () => {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current);
      }
    };
  }, [fetchData]);
  
  // Update countdown timer every second
  useEffect(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    
    countdownIntervalRef.current = setInterval(updateCountdown, 1000);
    
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [updateCountdown]);
  
  // Create context value object (this won't trigger re-renders in consumers)
  const contextValue = {
    getData: () => dataRef.current,
    isInitialLoading,
    isRefreshing,
    isTracking,
    lastUpdated,
    nextRefreshDisplay,
    refreshData: handleRefresh,
    toggleTracking
  };

  return (
    <ActivityDataContext.Provider value={contextValue}>
      {children}
    </ActivityDataContext.Provider>
  );
};

// Hook to access data in child components
const useActivityData = () => {
  const context = useContext(ActivityDataContext);
  if (!context) {
    throw new Error('useActivityData must be used within an ActivityDataProvider');
  }
  return context;
};

// Dashboard content (only re-renders when actual UI changes happen)
const DashboardContent = React.memo(() => {
  const { 
    isInitialLoading, 
    isRefreshing, 
    lastUpdated, 
    nextRefreshDisplay, 
    refreshData,
    isTracking,
    toggleTracking 
  } = useActivityData();
  
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev);
  }, []);
  
  if (isInitialLoading) {
    return (
      <div className="flex h-screen bg-black text-gray-100">
        <Sidebar isOpen={sidebarOpen} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Navbar toggleSidebar={toggleSidebar} />
          <main className="flex-1 overflow-y-auto p-4">
            <LoadingIndicator />
          </main>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex h-screen bg-black text-gray-100">
      <Sidebar isOpen={sidebarOpen} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar toggleSidebar={toggleSidebar} />
        
        <main className="flex-1 overflow-y-auto p-4">
          <div className="space-y-6">
            {/* Daily Tip component */}
            <div className="mt-4">
              <DailyTip />
            </div>
            
            {/* First row: TimeTrackingCard and CategoryBreakdown */}
            <div className="flex flex-row gap-6">
              <div className="w-2/3 h-[350px]">
                <TimeTrackingCardWrapper isTracking={isTracking} onToggleTracking={toggleTracking} />
              </div>
              <div className="w-1/3 h-[350px]">
                <CategoryBreakdownWrapper />
              </div>
            </div>
            
            {/* Second row: remaining components */}
            <div className="flex flex-row gap-6">
              <div className="w-1/3 bg-[#121212] rounded-lg shadow-lg h-[350px]">
                <ActivityLogWrapper />
              </div>
              <div className="w-1/3 bg-[#121212] rounded-lg shadow-lg h-[350px]">
                <UpcomingEvents />
              </div>
              <div className="w-1/3 bg-[#121212] rounded-lg shadow-lg h-[350px]">
                <GmailOverview />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
});

// Individual component wrappers to prevent re-renders
const TimelineBreakdownWrapper = React.memo(() => {
  const { getData } = useActivityData();
  return <TimelineBreakdown data={getData()} />;
});

const TotalTimeSpentWrapper = React.memo(({ isTracking, onToggleTracking }) => {
  const { getData } = useActivityData();
  return <TotalTimeSpent data={getData()} isTracking={isTracking} onToggleTracking={onToggleTracking} />;
});

const ActivityLogWrapper = React.memo(() => {
  const { getData } = useActivityData();
  return <ActivityLog data={getData()} />;
});

const CategoryBreakdownWrapper = React.memo(() => {
  const { getData } = useActivityData();
  return <CategoryBreakdown data={getData()} />;
});

const TimeTrackingCardWrapper = React.memo(({ isTracking, onToggleTracking }) => {
  const { getData } = useActivityData();
  return <TimeTrackingCard data={getData()} isTracking={isTracking} onToggleTracking={onToggleTracking} />;
});

// Main dashboard component
const MainDashboard = ({ user }) => {
  return (
    <ActivityDataProvider>
      <DashboardContent />
    </ActivityDataProvider>
  );
};

export default MainDashboard;
