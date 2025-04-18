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

  useEffect(() => {
    fetchQrCode();
    fetchStatus();

    socket.on('whatsapp-qr', (data) => {
      console.log('Received QR code from socket:', !!data.qr);
      setQrCode(data.qr);
    });

    socket.on('whatsapp-status', (data) => {
      console.log('Received status update:', data);
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

    const intervalId = setInterval(() => {
      fetchStatus();
      if (!status.connected && !qrCode) {
        console.log('Polling for QR code...');
        fetchQrCode();
      }
    }, 5000);

    return () => {
      socket.off('whatsapp-qr');
      socket.off('whatsapp-status');
      socket.off('whatsapp-message');
      clearInterval(intervalId);
    };
  }, [socket, status.connected]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchQrCode = async () => {
    try {
      console.log('Fetching QR code from API...');
      const response = await api.get('/bot/qr');
      console.log('QR code API response:', response.data);
      if (response.data.qrCode) {
        setQrCode(response.data.qrCode);
      }
    } catch (error) {
      console.error('Error fetching QR code:', error);
    }
  };

  const fetchStatus = async () => {
    try {
      const response = await api.get('/bot/status');
      setStatus(response.data.status);
    } catch (error) {
      console.error('Error fetching status:', error);
    }
  };

  const handleInputChange = (e) => {
    setMessageInput({
      ...messageInput,
      [e.target.name]: e.target.value
    });
  };

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
      
      setMessages(prev => [...prev, {
        id: Date.now(),
        sender: messageInput.number,
        text: messageInput.message,
        timestamp: new Date(),
        type: 'outgoing'
      }]);
      
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

  const handleLogout = async () => {
    try {
      setError(null);
      setLoading(true);
      console.log('Logging out WhatsApp session...');
      
      // Try a direct fetch instead of axios
      console.log('Trying direct fetch approach...');
      const fetchResponse = await fetch(`${api.defaults.baseURL}/bot/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const responseData = await fetchResponse.json();
      console.log('Fetch response:', responseData);
      
      // Clear QR code and status
      setQrCode(null);
      setStatus({ connected: false });
      
      // Start polling for new QR code
      setTimeout(fetchQrCode, 3000);
    } catch (error) {
      console.error('Error logging out:', error);
      setError('Failed to logout: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 text-gray-100 min-h-screen p-6">
      <h1 className="text-3xl font-bold text-indigo-400 mb-6">WhatsApp Bot Control</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gray-700 px-6 py-4 border-b border-gray-600 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-indigo-300">Connection Status</h2>
            <button 
              onClick={handleLogout}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1 rounded"
            >
              {loading ? 'Loading...' : 'Force Logout'}
            </button>
          </div>
          <div className="p-6">
            <div className="flex items-center mb-6">
              <span className={`w-3 h-3 rounded-full mr-2 ${status.connected ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span className="text-lg">{status.connected ? 'Connected' : 'Disconnected'}</span>
            </div>
            
            {!status.connected && qrCode && (
              <div className="flex flex-col items-center justify-center p-4 bg-white rounded-lg">
                <p className="text-gray-900 mb-4">Scan this QR code with WhatsApp to log in:</p>
                <QRCodeSVG value={qrCode} size={250} />
                <button 
                  onClick={fetchQrCode} 
                  className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded"
                >
                  Refresh QR Code
                </button>
              </div>
            )}
            
            {!status.connected && !qrCode && (
              <div className="flex flex-col items-center justify-center h-40 bg-gray-700/30 rounded-lg">
                <p className="text-gray-400">Waiting for QR code...</p>
                <button 
                  onClick={fetchQrCode} 
                  className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded"
                >
                  Try Again
                </button>
              </div>
            )}
            
            {error && <div className="mt-4 text-red-400 bg-red-900/30 p-3 rounded-md">{error}</div>}
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gray-700 px-6 py-4 border-b border-gray-600">
            <h2 className="text-xl font-semibold text-indigo-300">Send Message</h2>
          </div>
          <div className="p-6">
            <form onSubmit={handleSendMessage}>
              <div className="mb-4">
                <label htmlFor="number" className="block text-sm font-medium text-gray-300 mb-2">Phone Number (with country code, no +)</label>
                <input
                  type="text"
                  id="number"
                  name="number"
                  className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-4 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="e.g. 911234567890"
                  value={messageInput.number}
                  onChange={handleInputChange}
                  disabled={loading || !status.connected}
                />
              </div>
              
              <div className="mb-4">
                <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-2">Message</label>
                <textarea
                  id="message"
                  name="message"
                  className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-4 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-[120px]"
                  placeholder="Type your message here..."
                  value={messageInput.message}
                  onChange={handleInputChange}
                  disabled={loading || !status.connected}
                />
              </div>
              
              {error && <div className="mb-4 text-red-400 bg-red-900/30 p-3 rounded-md">{error}</div>}
              
              <button 
                type="submit" 
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-md shadow transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading || !status.connected}
              >
                {loading ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>
        </div>
      </div>
      
      <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <div className="bg-gray-700 px-6 py-4 border-b border-gray-600">
          <h2 className="text-xl font-semibold text-indigo-300">Message History</h2>
        </div>
        <div className="bg-gray-750 p-6 max-h-[500px] overflow-y-auto" ref={chatContainerRef}>
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-40 bg-gray-700/30 rounded-lg">
              <p className="text-gray-400">No messages yet. Send a message to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map(message => (
                <div 
                  key={message.id} 
                  className={`max-w-[80%] rounded-lg p-4 ${
                    message.type === 'outgoing' 
                      ? 'bg-indigo-600 ml-auto' 
                      : 'bg-gray-700 mr-auto'
                  }`}
                >
                  <div className="text-white mb-2">
                    {message.text}
                  </div>
                  {message.response && (
                    <div className="mt-2 pt-2 border-t border-gray-600 text-gray-300">
                      <strong>Response:</strong> {message.response}
                    </div>
                  )}
                  <div className="flex justify-between items-center mt-2 text-xs">
                    <span className="text-gray-300">{message.sender}</span>
                    <span className="text-gray-400">
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default WhatsappControl;
