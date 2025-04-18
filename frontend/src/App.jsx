import React, { useState, useEffect } from 'react';
import { Route, Routes, Navigate, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase';
import Dashboard from './components/Dashboard';
import WhatsappControl from './components/WhatsappControl';
import CommandPanel from './components/CommandPanel';
import ScreenshotPanel from './components/ScreenshotPanel';
import Navbar from './components/Navbar';
import LoginPage from './components/LoginPage';
import api from './services/api';

// Initialize socket connection
const socket = io('http://localhost:3000');

// Protected route component
const ProtectedRoute = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="w-12 h-12 border-t-2 border-b-2 border-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check authentication state
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      
      // If user is logged in, pass the token to the backend
      if (currentUser) {
        currentUser.getIdToken().then(token => {
          // Set the token in API service
          api.setAuthToken(token);
        });
      }
    });

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
      unsubscribe();
      socket.off('connect');
      socket.off('disconnect');
      socket.off('whatsapp-status');
      socket.off('whatsapp-message');
      socket.off('error');
    };
  }, [navigate]);

  const addNotification = (message, type = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="w-12 h-12 border-t-2 border-b-2 border-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-gray-100">
      {user && (
        <header className="bg-gray-800 border-b border-gray-700 shadow-md py-4 px-6">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-bold text-indigo-400">WhatsApp Bot Platform</h1>
            <div className="flex items-center space-x-4">
              <div className="connection-status">
                <span className={`px-3 py-1 rounded-full text-sm ${isConnected ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                  {isConnected ? 'Connected to Backend' : 'Disconnected'}
                </span>
              </div>
              <div className="user-profile flex items-center space-x-2">
                <img 
                  src={user.photoURL || 'https://via.placeholder.com/32'} 
                  alt={user.displayName || 'User'} 
                  className="w-8 h-8 rounded-full"
                />
                <span className="text-sm text-gray-300">{user.displayName || user.email}</span>
              </div>
            </div>
          </div>
        </header>
      )}

      {user && <Navbar user={user} />}

      <main className="flex-grow">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={
            <ProtectedRoute>
              <Dashboard socket={socket} user={user} />
            </ProtectedRoute>
          } />
          <Route path="/whatsapp" element={
            <ProtectedRoute>
              <WhatsappControl socket={socket} user={user} />
            </ProtectedRoute>
          } />
          <Route path="/commands" element={
            <ProtectedRoute>
              <CommandPanel socket={socket} user={user} />
            </ProtectedRoute>
          } />
          <Route path="/screenshots" element={
            <ProtectedRoute>
              <ScreenshotPanel socket={socket} user={user} />
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
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
