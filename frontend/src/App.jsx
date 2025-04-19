import React, { useState, useEffect } from 'react';
import { Route, Routes, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, logOut, getGoogleToken } from './services/firebase';
import Dashboard from './components/Dashboard';
import WhatsappControl from './components/WhatsappControl';
import CommandPanel from './components/CommandPanel';
import ScreenshotPanel from './components/ScreenshotPanel';
import Navbar from './components/Navbar';
import LoginPage from './components/LoginPage';
import MainDashboard from './pages/dashboard/MainDashboard';
import api from './services/api';

// Initialize socket connection
const socket = io('http://localhost:3000');

// Protected route component
const ProtectedRoute = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
          // Get token and set it in API
          const token = await currentUser.getIdToken();
          api.setAuthToken(token);
          
          // Get Google token for Calendar API
          const googleToken = getGoogleToken();
          if (googleToken) {
            // Inform backend about Google token for Calendar integration
            try {
              await api.post('/calendar/set-google-token', { 
                googleToken,
                userInfo: {
                  sub: currentUser.uid,
                  email: currentUser.email
                }
              });
              console.log('Google token sent to backend for Calendar API');
            } catch (err) {
              console.warn('Error setting Google token in backend:', err);
            }
          }
        } catch (err) {
          console.error('Error setting up auth token:', err);
        }
      }
      
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [navigate]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="w-12 h-12 border-t-2 border-b-2 border-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }
  
  if (!user) {
    // Save the attempted URL for redirecting after login
    const redirectUrl = location.pathname !== '/login' ? location.pathname : '/analytics';
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirectUrl)}`} replace />;
  }
  
  return children;
};

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

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
          
          // Only check backend status after token is set
          checkStatus(token);
        });
      } else {
        setIsConnected(false);
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

    // Check backend status - now this will be called only after token is set
    const checkStatus = async (token) => {
      try {
        const response = await api.get('/bot/status');
        setIsConnected(true);
      } catch (error) {
        console.error('Backend connection error:', error);
        setIsConnected(false);
      }
    };

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

  const handleLogout = async () => {
    try {
      await logOut();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      addNotification(`Logout failed: ${error.message}`, 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="w-12 h-12 border-t-2 border-b-2 border-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-black text-gray-100">
      {user && <Navbar user={user} isConnected={isConnected} onLogout={handleLogout} />}

      <main className="flex-grow">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/analytics" replace />} />
          <Route path="/analytics" element={
            <ProtectedRoute>
              <MainDashboard user={user} />
            </ProtectedRoute>
          } />
          <Route path="/dashboard" element={
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
          <Route path="*" element={<Navigate to="/analytics" replace />} />
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
