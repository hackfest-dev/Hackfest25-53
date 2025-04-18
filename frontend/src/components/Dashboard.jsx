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
    <div className="dashboard">
      <h1 className="page-title">Dashboard</h1>
      
      <div className="grid-container">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">WhatsApp Status</h2>
          </div>
          <div className="card-content">
            <div className="status-indicator">
              <span className={`status-dot ${whatsappStatus ? 'connected' : 'disconnected'}`}></span>
              <span className="status-text">{whatsappStatus ? 'Connected' : 'Disconnected'}</span>
            </div>
            <div className="card-actions">
              <Link to="/whatsapp" className="button button-primary">Manage WhatsApp</Link>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">System Information</h2>
          </div>
          <div className="card-content">
            <div className="info-row">
              <span className="info-label">Platform:</span>
              <span className="info-value">{systemInfo.platform}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Browser:</span>
              <span className="info-value">{navigator.userAgent.split(' ').slice(-1)[0]}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Uptime:</span>
              <span className="info-value">{systemInfo.uptime}</span>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Quick Actions</h2>
          </div>
          <div className="quick-actions">
            <Link to="/screenshots" className="button button-secondary">Take Screenshot</Link>
            <Link to="/commands" className="button button-secondary">Run Command</Link>
            <Link to="/whatsapp" className="button button-secondary">Send Message</Link>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Recent Messages</h2>
          </div>
          <div className="card-content">
            {recentMessages.length > 0 ? (
              <div className="message-list">
                {recentMessages.map((msg, index) => (
                  <div key={index} className="message-item">
                    <div className="message-header">
                      <span className="message-sender">{msg.sender}</span>
                      <span className="message-time">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="message-text">{msg.message.substring(0, 40)}...</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-list">No recent messages.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
