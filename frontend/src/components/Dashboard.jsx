import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

function Dashboard({ socket }) {
  const [whatsappStatus, setWhatsappStatus] = useState(false);
  const [recentMessages, setRecentMessages] = useState([]);
  const [systemInfo, setSystemInfo] = useState({
    platform: 'Loading...',
    uptime: 'Loading...',
  });

  useEffect(() => {
    // Check WhatsApp connection status
    const checkStatus = async () => {
      try {
        const response = await api.get('/bot/status');
        setWhatsappStatus(response.data.status.connected);
      } catch (error) {
        console.error('Error checking WhatsApp status:', error);
      }
    };

    // Get system information
    const getSystemInfo = async () => {
      try {
        const platformInfo = window.navigator.platform;
        const uptimeMinutes = Math.floor(performance.now() / 60000);
        
        setSystemInfo({
          platform: platformInfo,
          uptime: `${uptimeMinutes} minutes`,
        });
      } catch (error) {
        console.error('Error getting system info:', error);
      }
    };

    // Register socket listeners for real-time updates
    socket.on('whatsapp-status', (data) => {
      setWhatsappStatus(data.status === 'connected');
    });

    socket.on('whatsapp-message', (data) => {
      setRecentMessages(prev => [data, ...prev].slice(0, 5));
    });

    // Initial data load
    checkStatus();
    getSystemInfo();

    // Cleanup function
    return () => {
      socket.off('whatsapp-status');
      socket.off('whatsapp-message');
    };
  }, [socket]);

  return (
    <div className="bg-gray-900 text-gray-100 min-h-screen p-6">
      <h1 className="text-3xl font-bold text-indigo-400 mb-6">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gray-700 px-6 py-4 border-b border-gray-600">
            <h2 className="text-xl font-semibold text-indigo-300">WhatsApp Status</h2>
          </div>
          <div className="p-6">
            <div className="flex items-center mb-4">
              <span className={`w-3 h-3 rounded-full mr-2 ${whatsappStatus ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span className="text-lg">{whatsappStatus ? 'Connected' : 'Disconnected'}</span>
            </div>
            <div className="mt-4">
              <Link to="/whatsapp" className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-md shadow transition-colors duration-200">
                Manage WhatsApp
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gray-700 px-6 py-4 border-b border-gray-600">
            <h2 className="text-xl font-semibold text-indigo-300">System Information</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-gray-400">Platform:</div>
              <div className="text-gray-200">{systemInfo.platform}</div>
              
              <div className="text-gray-400">Browser:</div>
              <div className="text-gray-200">{navigator.userAgent.split(' ').slice(-1)[0]}</div>
              
              <div className="text-gray-400">Uptime:</div>
              <div className="text-gray-200">{systemInfo.uptime}</div>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gray-700 px-6 py-4 border-b border-gray-600">
            <h2 className="text-xl font-semibold text-indigo-300">Quick Actions</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link to="/screenshots" className="bg-gray-700 hover:bg-gray-600 text-gray-200 text-center py-3 px-4 rounded-md shadow transition-colors duration-200">
              Take Screenshot
            </Link>
            <Link to="/commands" className="bg-gray-700 hover:bg-gray-600 text-gray-200 text-center py-3 px-4 rounded-md shadow transition-colors duration-200">
              Run Command
            </Link>
            <Link to="/whatsapp" className="bg-gray-700 hover:bg-gray-600 text-gray-200 text-center py-3 px-4 rounded-md shadow transition-colors duration-200">
              Send Message
            </Link>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gray-700 px-6 py-4 border-b border-gray-600">
            <h2 className="text-xl font-semibold text-indigo-300">Recent Messages</h2>
          </div>
          <div className="p-6">
            {recentMessages.length > 0 ? (
              <div className="space-y-4">
                {recentMessages.map((msg, index) => (
                  <div key={index} className="bg-gray-700 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-indigo-300">{msg.sender}</span>
                      <span className="text-gray-400 text-xs">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-gray-300">{msg.message.substring(0, 40)}...</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 italic">No recent messages.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
