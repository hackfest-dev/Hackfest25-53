import React, { useState, useEffect } from 'react';
import { Route, Routes, NavLink } from 'react-router-dom';
import { io } from 'socket.io-client';
import Dashboard from './components/Dashboard';
import WhatsappControl from './components/WhatsappControl';
import CommandPanel from './components/CommandPanel';
import ScreenshotPanel from './components/ScreenshotPanel';
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
    <div className="app-container">
      <header className="app-header">
        <h1>WhatsApp Bot Platform</h1>
        <div className="connection-status">
          <span className={isConnected ? 'connected' : 'disconnected'}>
            {isConnected ? 'Connected to Backend' : 'Disconnected'}
          </span>
        </div>
      </header>

      <nav className="app-nav">
        <NavLink to="/" end>Dashboard</NavLink>
        <NavLink to="/whatsapp">WhatsApp Bot</NavLink>
        <NavLink to="/commands">Command Panel</NavLink>
        <NavLink to="/screenshots">Screenshot Panel</NavLink>
      </nav>

      <main className="app-content">
        <Routes>
          <Route path="/" element={<Dashboard socket={socket} />} />
          <Route path="/whatsapp" element={<WhatsappControl socket={socket} />} />
          <Route path="/commands" element={<CommandPanel socket={socket} />} />
          <Route path="/screenshots" element={<ScreenshotPanel socket={socket} />} />
        </Routes>
      </main>

      <div className="notifications-container">
        {notifications.map(notification => (
          <div key={notification.id} className={`notification ${notification.type}`}>
            {notification.message}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
