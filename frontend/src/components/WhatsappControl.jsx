import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../services/api';

function WhatsappControl({ socket }) {
  const [qrCode, setQrCode] = useState(null);
  const [status, setStatus] = useState({ connected: false });
  const [messageInput, setMessageInput] = useState({ number: '', message: '' });
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const chatContainerRef = useRef(null);

  // Fetch QR code and status on mount
  useEffect(() => {
    fetchQrCode();
    fetchStatus();

    // Socket listeners for real-time updates
    socket.on('whatsapp-qr', (data) => {
      setQrCode(data.qr);
    });

    socket.on('whatsapp-status', (data) => {
      setStatus({ connected: data.status === 'connected' });
      if (data.status === 'connected') {
        setQrCode(null);
      }
    });

    socket.on('whatsapp-message', (data) => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        sender: data.sender,
        text: data.message,
        response: data.response,
        timestamp: new Date(data.timestamp),
        type: 'incoming'
      }]);
    });

    // Function to periodically check status and QR code
    const intervalId = setInterval(() => {
      fetchStatus();
      if (!status.connected) {
        fetchQrCode();
      }
    }, 10000);

    return () => {
      socket.off('whatsapp-qr');
      socket.off('whatsapp-status');
      socket.off('whatsapp-message');
      clearInterval(intervalId);
    };
  }, [socket, status.connected]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Fetch QR code from API
  const fetchQrCode = async () => {
    try {
      const response = await api.get('/bot/qr');
      if (response.data.qrCode) {
        setQrCode(response.data.qrCode);
      }
    } catch (error) {
      console.error('Error fetching QR code:', error);
    }
  };

  // Fetch connection status from API
  const fetchStatus = async () => {
    try {
      const response = await api.get('/bot/status');
      setStatus(response.data.status);
    } catch (error) {
      console.error('Error fetching status:', error);
    }
  };

  // Handle input changes
  const handleInputChange = (e) => {
    setMessageInput({
      ...messageInput,
      [e.target.name]: e.target.value
    });
  };

  // Send a message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!messageInput.number || !messageInput.message) {
      setError('Please enter both phone number and message');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.post('/bot/send', {
        number: messageInput.number,
        message: messageInput.message
      });
      
      // Add sent message to the list
      setMessages(prev => [...prev, {
        id: Date.now(),
        sender: messageInput.number,
        text: messageInput.message,
        timestamp: new Date(),
        type: 'outgoing'
      }]);
      
      // Clear message input but keep the number
      setMessageInput({
        ...messageInput,
        message: ''
      });
      
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="whatsapp-control">
      <h1 className="page-title">WhatsApp Bot Control</h1>
      
      <div className="grid-container two-col">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Connection Status</h2>
          </div>
          <div className="card-content">
            <div className="status-indicator">
              <span className={`status-dot ${status.connected ? 'connected' : 'disconnected'}`}></span>
              <span className="status-text">{status.connected ? 'Connected' : 'Disconnected'}</span>
            </div>
            
            {!status.connected && qrCode && (
              <div className="qr-container">
                <p>Scan this QR code with WhatsApp to log in:</p>
                <QRCodeSVG value={qrCode} size={250} />
              </div>
            )}
            
            {!status.connected && !qrCode && (
              <div className="loading-qr">
                <p>Waiting for QR code...</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Send Message</h2>
          </div>
          <div className="card-content">
            <form onSubmit={handleSendMessage}>
              <div className="form-group">
                <label htmlFor="number" className="form-label">Phone Number (with country code, no +)</label>
                <input
                  type="text"
                  id="number"
                  name="number"
                  className="form-input"
                  placeholder="e.g. 911234567890"
                  value={messageInput.number}
                  onChange={handleInputChange}
                  disabled={loading || !status.connected}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="message" className="form-label">Message</label>
                <textarea
                  id="message"
                  name="message"
                  className="form-textarea"
                  placeholder="Type your message here..."
                  value={messageInput.message}
                  onChange={handleInputChange}
                  disabled={loading || !status.connected}
                />
              </div>
              
              {error && <div className="error-message">{error}</div>}
              
              <button 
                type="submit" 
                className="button button-primary"
                disabled={loading || !status.connected}
              >
                {loading ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>
        </div>
      </div>
      
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Message History</h2>
        </div>
        <div className="chat-container" ref={chatContainerRef}>
          {messages.length === 0 ? (
            <div className="empty-chat">
              <p>No messages yet. Send a message to get started.</p>
            </div>
          ) : (
            messages.map(message => (
              <div key={message.id} className={`chat-message ${message.type}`}>
                <div className="message-content">
                  {message.text}
                </div>
                {message.response && (
                  <div className="message-response">
                    <strong>Response:</strong> {message.response}
                  </div>
                )}
                <div className="message-meta">
                  <span className="message-sender">{message.sender}</span>
                  <span className="message-time">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default WhatsappControl;
