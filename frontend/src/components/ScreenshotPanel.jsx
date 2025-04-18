import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';

function ScreenshotPanel() {
  const [screenshotData, setScreenshotData] = useState(null);
  const [screenshotHistory, setScreenshotHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showBrowserScreenshot, setShowBrowserScreenshot] = useState(false);
  const screenshotRef = useRef(null);

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

  useEffect(() => {
    if (screenshotHistory.length > 0) {
      localStorage.setItem('screenshotHistory', JSON.stringify(screenshotHistory));
    }
  }, [screenshotHistory]);

  const handleTakeScreenshot = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get('/screenshot');
      const screenshotUrl = `${api.defaults.baseURL}/screenshot/${response.data.filename}`;
      
      setScreenshotData({
        url: screenshotUrl,
        filename: response.data.filename,
        timestamp: new Date(),
        size: response.data.size
      });
      
      addToHistory(response.data.filename, screenshotUrl, response.data.size);
      
    } catch (error) {
      console.error('Screenshot error:', error);
      let errorMessage = 'Failed to take screenshot';
      
      if (error.response?.data) {
        errorMessage = error.response.data.message || errorMessage;
        
        if (error.response.data.error) {
          if (error.response.data.error.includes('nircmd')) {
            errorMessage = 'Screenshot tool (nircmd) not found on this system.';
            setShowBrowserScreenshot(true);
          } else {
            errorMessage += `: ${error.response.data.error}`;
          }
        }
        
        if (error.response.data.solution) {
          errorMessage += ` ${error.response.data.solution}`;
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleBrowserScreenshot = async () => {
    setLoading(true);
    setError(null);
    
    try {
      let html2canvas;
      try {
        html2canvas = (await import('html2canvas')).default;
      } catch (importError) {
        console.error('Error importing html2canvas:', importError);
        setError('Required screenshot library not found. Please run "npm install html2canvas" in the frontend directory.');
        setLoading(false);
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const canvas = await html2canvas(document.body, {
        ignoreElements: element => element === screenshotRef.current
      });
      
      const imageData = canvas.toDataURL('image/png');
      const response = await api.post('/screenshot/browser-screenshot', { imageData });
      const screenshotUrl = `${api.defaults.baseURL}/screenshot/${response.data.filename}`;
      
      setScreenshotData({
        url: screenshotUrl,
        filename: response.data.filename,
        timestamp: new Date(),
        size: response.data.size,
        browser: true
      });
      
      addToHistory(response.data.filename, screenshotUrl, response.data.size, true);
      setShowBrowserScreenshot(false);
      
    } catch (error) {
      console.error('Browser screenshot error:', error);
      setError('Failed to take browser screenshot. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
    ].slice(0, 10));
  };

  const handleViewScreenshot = (screenshot) => {
    setScreenshotData(screenshot);
  };

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
    <div className="bg-gray-900 text-gray-100 min-h-screen p-6" ref={screenshotRef}>
      <h1 className="text-3xl font-bold text-indigo-400 mb-6">Screenshot Panel</h1>
      
      <div className="flex flex-wrap gap-4 mb-6">
        <button 
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-md shadow transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleTakeScreenshot}
          disabled={loading}
        >
          {loading ? 'Taking Screenshot...' : 'Take System Screenshot'}
        </button>
        
        {showBrowserScreenshot && (
          <button 
            className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-6 rounded-md shadow transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleBrowserScreenshot}
            disabled={loading}
          >
            Take Browser Screenshot
          </button>
        )}
        
        {screenshotData && (
          <button 
            className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-6 rounded-md shadow transition-colors duration-200"
            onClick={handleDownloadScreenshot}
          >
            Download Screenshot
          </button>
        )}
      </div>
      
      {error && <div className="mb-6 text-red-400 bg-red-900/30 p-4 rounded-lg">{error}</div>}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gray-700 px-6 py-4 border-b border-gray-600">
            <h2 className="text-xl font-semibold text-indigo-300">Current Screenshot</h2>
          </div>
          <div className="p-6">
            {screenshotData ? (
              <div className="space-y-4">
                <div className="bg-gray-900 rounded-lg overflow-hidden">
                  <img 
                    src={screenshotData.url} 
                    alt="Screenshot" 
                    className="w-full h-auto" 
                  />
                </div>
                <div className="bg-gray-700 p-4 rounded-lg text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-gray-400">Filename:</span>
                    <span className="text-gray-200">{screenshotData.filename}</span>
                    
                    <span className="text-gray-400">Time:</span>
                    <span className="text-gray-200">{new Date(screenshotData.timestamp).toLocaleString()}</span>
                    
                    <span className="text-gray-400">Size:</span>
                    <span className="text-gray-200">{screenshotData.size}</span>
                  </div>
                  {screenshotData.browser && (
                    <div className="mt-2">
                      <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded-full">Browser Screenshot</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 bg-gray-700/30 rounded-lg">
                <p className="text-center">No screenshot taken yet. Click the "Take Screenshot" button to capture your screen.</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gray-700 px-6 py-4 border-b border-gray-600">
            <h2 className="text-xl font-semibold text-indigo-300">Screenshot History</h2>
          </div>
          <div className="p-6">
            {screenshotHistory.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-400 bg-gray-700/30 rounded-lg">
                <p className="text-center">No screenshot history yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {screenshotHistory.map(screenshot => (
                  <div 
                    key={screenshot.id} 
                    className="group cursor-pointer bg-gray-700 rounded-lg overflow-hidden hover:ring-2 hover:ring-indigo-500 transition-all duration-200"
                    onClick={() => handleViewScreenshot(screenshot)}
                  >
                    <div className="aspect-video bg-gray-900 overflow-hidden">
                      <img 
                        src={screenshot.url} 
                        alt="Screenshot thumbnail" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">{new Date(screenshot.timestamp).toLocaleTimeString()}</span>
                        {screenshot.browser && (
                          <span className="bg-indigo-500/20 text-indigo-300 px-1 rounded">Browser</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <div className="bg-gray-700 px-6 py-4 border-b border-gray-600">
          <h2 className="text-xl font-semibold text-indigo-300">Screenshot Help</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <h3 className="font-medium text-indigo-300 mb-1">System Screenshot</h3>
            <p className="text-gray-300">
              Takes a screenshot using your operating system's screenshot capabilities. This captures your entire screen.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-indigo-300 mb-1">Browser Screenshot</h3>
            <p className="text-gray-300">
              Takes a screenshot of the current browser window content only. Use this if the system screenshot doesn't work.
            </p>
          </div>
          <div className="bg-indigo-900/20 p-4 rounded-lg border border-indigo-800">
            <p className="text-indigo-300">
              <strong>Note:</strong> Screenshots are temporarily stored and will be automatically deleted after a period of time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScreenshotPanel;