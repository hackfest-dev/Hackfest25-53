import React, { useState, useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { io } from 'socket.io-client';
import Dashboard from './components/Dashboard';
import WhatsappControl from './components/WhatsappControl';
import CommandPanel from './components/CommandPanel';
import ScreenshotPanel from './components/ScreenshotPanel';
import Navbar from './components/Navbar';
import api from './services/api';

// Initialize socket connection
const socket = io('http://localhost:3000');

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    // Socket connection handlers
    socket.on('connect', () => {
      console.log('Connected to backend');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from backend');
      setIsConnected(false);
    });

    socket.on('whatsapp-status', (data) => {
      addNotification(`WhatsApp Status: ${data.status} - ${data.message}`);
    });

    socket.on('whatsapp-message', (data) => {
      addNotification(`New message from ${data.sender}: ${data.message.substring(0, 30)}...`);
    });

    socket.on('error', (data) => {
      addNotification(`Error: ${data.message}`, 'error');
    });

    // Check backend status
    const checkStatus = async () => {
      try {
        await api.get('/bot/status');
      } catch (error) {
        console.error('Backend connection error:', error);
        setIsConnected(false);
      }
    };
    
    checkStatus();

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('whatsapp-status');
      socket.off('whatsapp-message');
      socket.off('error');
    };
  }, []);

  const addNotification = (message, type = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-gray-100">
      <header className="bg-gray-800 border-b border-gray-700 shadow-md py-4 px-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-indigo-400">WhatsApp Bot Platform</h1>
          <div className="connection-status">
            <span className={`px-3 py-1 rounded-full text-sm ${isConnected ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
              {isConnected ? 'Connected to Backend' : 'Disconnected'}
            </span>
          </div>
        </div>
      </header>

      {/* Use the Navbar component instead of inline navigation */}
      <Navbar />

      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Dashboard socket={socket} />} />
          <Route path="/whatsapp" element={<WhatsappControl socket={socket} />} />
          <Route path="/commands" element={<CommandPanel socket={socket} />} />
          <Route path="/screenshots" element={<ScreenshotPanel socket={socket} />} />
        </Routes>
      </main>

      <div className="fixed bottom-4 right-4 space-y-2 max-w-md">
        {notifications.map(notification => (
          <div 
            key={notification.id} 
            className={`p-3 rounded-lg shadow-lg animate-fade-in ${
              notification.type === 'error' 
                ? 'bg-red-900/90 text-red-200 border-l-4 border-red-500'
                : 'bg-gray-800/90 text-gray-200 border-l-4 border-indigo-500'
            }`}
          >
            {notification.message}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
