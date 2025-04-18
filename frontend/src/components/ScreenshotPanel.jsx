import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';

function ScreenshotPanel() {
  const [screenshotData, setScreenshotData] = useState(null);
  const [screenshotHistory, setScreenshotHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showBrowserScreenshot, setShowBrowserScreenshot] = useState(false);
  const screenshotRef = useRef(null);

  // Load screenshot history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('screenshotHistory');
    if (savedHistory) {
      try {
        setScreenshotHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Error parsing screenshot history:', e);
      }
    }
  }, []);

  // Save history to localStorage when it changes
  useEffect(() => {
    if (screenshotHistory.length > 0) {
      localStorage.setItem('screenshotHistory', JSON.stringify(screenshotHistory));
    }
  }, [screenshotHistory]);

  // Take a system screenshot
  const handleTakeScreenshot = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get('/screenshot');
      
      // Create full URL to access the screenshot
      const screenshotUrl = `${api.defaults.baseURL}/screenshot/${response.data.filename}`;
      
      // Update state with new screenshot data
      setScreenshotData({
        url: screenshotUrl,
        filename: response.data.filename,
        timestamp: new Date(),
        size: response.data.size
      });
      
      // Add to history
      addToHistory(response.data.filename, screenshotUrl, response.data.size);
      
    } catch (error) {
      console.error('Screenshot error:', error);
      
      // Extract detailed error information
      let errorMessage = 'Failed to take screenshot';
      
      if (error.response?.data) {
        errorMessage = error.response.data.message || errorMessage;
        
        // Include more detailed error if available
        if (error.response.data.error) {
          if (error.response.data.error.includes('nircmd')) {
            errorMessage = 'Screenshot tool (nircmd) not found on this system.';
            setShowBrowserScreenshot(true);
          } else {
            errorMessage += `: ${error.response.data.error}`;
          }
        }
        
        // If a solution is provided, add it to the error message
        if (error.response.data.solution) {
          errorMessage += ` ${error.response.data.solution}`;
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Take a browser-based screenshot as fallback
  const handleBrowserScreenshot = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Import html2canvas more reliably
      let html2canvas;
      try {
        html2canvas = (await import('html2canvas')).default;
      } catch (importError) {
        console.error('Error importing html2canvas:', importError);
        setError('Required screenshot library not found. Please run "npm install html2canvas" in the frontend directory.');
        setLoading(false);
        return;
      }
      
      // Wait to ensure the import is complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Take browser screenshot (excluding this panel itself if possible)
      const canvas = await html2canvas(document.body, {
        ignoreElements: element => element === screenshotRef.current
      });
      
      // Convert canvas to data URL
      const imageData = canvas.toDataURL('image/png');
      
      // Send to server - FIXED PATH
      const response = await api.post('/screenshot/browser-screenshot', { imageData });
      
      // Create full URL to access the screenshot - FIXED URL CONSTRUCTION
      const screenshotUrl = `${api.defaults.baseURL}/screenshot/${response.data.filename}`;
      
      // Update state with new screenshot data
      setScreenshotData({
        url: screenshotUrl,
        filename: response.data.filename,
        timestamp: new Date(),
        size: response.data.size,
        browser: true
      });
      
      // Add to history
      addToHistory(response.data.filename, screenshotUrl, response.data.size, true);
      
      // Hide browser screenshot option after successful capture
      setShowBrowserScreenshot(false);
      
    } catch (error) {
      console.error('Browser screenshot error:', error);
      setError('Failed to take browser screenshot. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to add to history
  const addToHistory = (filename, url, size, isBrowser = false) => {
    setScreenshotHistory(prev => [
      {
        id: Date.now(),
        filename,
        url,
        timestamp: new Date(),
        size,
        browser: isBrowser
      },
      ...prev
    ].slice(0, 10)); // Keep only the last 10 screenshots
  };

  // View a screenshot from history
  const handleViewScreenshot = (screenshot) => {
    setScreenshotData(screenshot);
  };

  // Download the current screenshot
  const handleDownloadScreenshot = () => {
    if (screenshotData) {
      const link = document.createElement('a');
      link.href = screenshotData.url;
      link.download = screenshotData.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="screenshot-panel" ref={screenshotRef}>
      <h1 className="page-title">Screenshot Panel</h1>
      
      <div className="screenshot-actions">
        <button 
          className="button button-primary"
          onClick={handleTakeScreenshot}
          disabled={loading}
        >
          {loading ? 'Taking Screenshot...' : 'Take System Screenshot'}
        </button>
        
        {showBrowserScreenshot && (
          <button 
            className="button button-secondary"
            onClick={handleBrowserScreenshot}
            disabled={loading}
          >
            Take Browser Screenshot
          </button>
        )}
        
        {screenshotData && (
          <button 
            className="button button-secondary"
            onClick={handleDownloadScreenshot}
          >
            Download Screenshot
          </button>
        )}
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="grid-container two-col">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Current Screenshot</h2>
          </div>
          <div className="card-content">
            {screenshotData ? (
              <div className="screenshot-container">
                <img 
                  src={screenshotData.url} 
                  alt="Screenshot" 
                  className="screenshot-image" 
                />
                <div className="screenshot-info">
                  <p>Filename: {screenshotData.filename}</p>
                  <p>Time: {new Date(screenshotData.timestamp).toLocaleString()}</p>
                  <p>Size: {screenshotData.size}</p>
                  {screenshotData.browser && (
                    <p className="screenshot-badge">Browser Screenshot</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="empty-screenshot">
                <p>No screenshot taken yet. Click the "Take Screenshot" button to capture your screen.</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Screenshot History</h2>
          </div>
          <div className="card-content">
            {screenshotHistory.length === 0 ? (
              <p className="empty-list">No screenshot history yet.</p>
            ) : (
              <div className="history-list">
                {screenshotHistory.map(screenshot => (
                  <div key={screenshot.id} className="history-item">
                    <div className="screenshot-thumbnail" onClick={() => handleViewScreenshot(screenshot)}>
                      <img 
                        src={screenshot.url} 
                        alt="Screenshot thumbnail" 
                      />
                    </div>
                    <div className="history-item-details">
                      <p>{new Date(screenshot.timestamp).toLocaleTimeString()}</p>
                      <p>{screenshot.size}</p>
                      {screenshot.browser && (
                        <span className="history-badge">Browser</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Help section */}
      <div className="card mt-4">
        <div className="card-header">
          <h2 className="card-title">Screenshot Help</h2>
        </div>
        <div className="card-content">
          <p>
            <strong>System Screenshot:</strong> Takes a screenshot using your operating system's 
            screenshot capabilities. This captures your entire screen.
          </p>
          <p>
            <strong>Browser Screenshot:</strong> Takes a screenshot of the current browser window 
            content only. Use this if the system screenshot doesn't work.
          </p>
          <p>
            <strong>Note:</strong> Screenshots are temporarily stored and will be automatically 
            deleted after a period of time.
          </p>
        </div>
      </div>
    </div>
  );
}

export default ScreenshotPanel;