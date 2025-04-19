import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { FaMobile, FaWhatsapp, FaQrcode, FaPowerOff, FaSync, FaPaperPlane, FaInfoCircle } from 'react-icons/fa';
import Navbar from './dashboard/Navbar';
import Sidebar from './dashboard/Sidebar';
import api from '../services/api';

function WhatsappControl({ socket }) {
  const [qrCode, setQrCode] = useState(null);
  const [status, setStatus] = useState({ connected: false });
  const [messageInput, setMessageInput] = useState({ number: '', message: '' });
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [backendStatus, setBackendStatus] = useState({ isAlive: true, checking: false });
  const [logoutPolling, setLogoutPolling] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev);
  };

  const checkBackendConnection = async () => {
    setBackendStatus(prev => ({ ...prev, checking: true }));
    try {
      const result = await api.healthCheck();
      setBackendStatus({ isAlive: result.isAlive, checking: false, message: result.message });
      
      if (result.isAlive) {
        fetchStatus();
        if (!status.connected && !qrCode) {
          fetchQrCode();
        }
      }
    } catch (err) {
      setBackendStatus({ 
        isAlive: false, 
        checking: false, 
        message: "Cannot connect to backend server" 
      });
    }
  };

  useEffect(() => {
    checkBackendConnection();
    
    const intervalId = setInterval(checkBackendConnection, 15000);
    
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (backendStatus.isAlive) {
      fetchQrCode();
      fetchStatus();

      socket.on('whatsapp-qr', (data) => {
        setQrCode(data.qr);
        setStatus({ connected: false });
      });

      socket.on('whatsapp-status', (data) => {
        if (data.connected !== undefined) {
          setStatus({ connected: data.connected });
        } else if (data.status === 'connected') {
          setStatus({ connected: true });
        } else {
          setStatus({ connected: false });
        }
        
        if (data.status === 'connected' || data.connected === true) {
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

      const statusInterval = setInterval(() => {
        if (backendStatus.isAlive) {
          fetchStatus();
          if (!status.connected && !qrCode) {
            fetchQrCode();
          }
        }
      }, 5000);

      return () => {
        socket.off('whatsapp-qr');
        socket.off('whatsapp-status');
        socket.off('whatsapp-message');
        clearInterval(statusInterval);
      };
    }
  }, [socket, backendStatus.isAlive]);

  const fetchQrCode = async () => {
    try {
      const response = await api.get('/bot/qr');
      if (response.data.qrCode) {
        setQrCode(response.data.qrCode);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  };

  const fetchStatus = async () => {
    try {
      const response = await api.get('/bot/status');
      if (response.data && response.data.status) {
        if (typeof response.data.status === 'object') {
          setStatus(response.data.status);
        } else if (response.data.status === 'online') {
          setStatus({ connected: true });
        } else {
          setStatus({ connected: false });
        }
      }
    } catch (error) {
      setStatus({ connected: false });
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
      
      setStatus({ connected: false });
      setQrCode(null);
      
      const responseData = await api.logoutWhatsApp();
      
      setLogoutPolling(true);
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      await fetchStatus();
      
      let attempts = 0;
      const maxAttempts = 15;
      const pollForQrCode = async () => {
        if (attempts >= maxAttempts) {
          setError('Failed to get QR code after multiple attempts. Please refresh the page.');
          setLogoutPolling(false);
          return;
        }
        
        const waitTime = Math.min(1500 + attempts * 1000, 6000);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        if (attempts % 3 === 0) {
          await fetchStatus();
        }
        
        const success = await fetchQrCode();
        if (success) {
          setLogoutPolling(false);
        } else {
          attempts++;
          pollForQrCode();
        }
      };
      
      pollForQrCode();
    } catch (error) {
      setError('Failed to logout: ' + (error.message || 'Unknown error'));
      setLogoutPolling(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-black text-gray-100">
      <Sidebar isOpen={sidebarOpen} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar toggleSidebar={toggleSidebar} />
        
        <main className="flex-1 overflow-y-auto p-4 bg-black">
          <div className="max-w-6xl mx-auto">
            {/* Page Title */}
            <div className="flex items-center gap-3 mb-6">
              <FaWhatsapp className="text-2xl text-green-500" />
              <h1 className="text-2xl font-semibold bg-gradient-to-b from-[#4c3d8b] to-[#5e4e99] bg-clip-text text-transparent">
                WhatsApp Integration
              </h1>
            </div>
            
            {/* Connection Status Banner */}
            <div className="mb-6">
              {!backendStatus.isAlive ? (
                <div className="bg-red-900/50 border border-red-800 text-white p-4 rounded-lg flex items-center justify-between">
                  <div className="flex items-center">
                    <FaInfoCircle className="text-red-400 mr-3" />
                    <div>
                      <p className="font-medium">Backend Connection Error</p>
                      <p className="text-sm text-gray-300">{backendStatus.message || "Cannot connect to backend server"}</p>
                    </div>
                  </div>
                  <button 
                    onClick={checkBackendConnection} 
                    disabled={backendStatus.checking}
                    className="bg-red-800 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors"
                  >
                    {backendStatus.checking ? 'Checking...' : 'Retry Connection'}
                  </button>
                </div>
              ) : (
                <div className={`${status.connected ? 'bg-[#1F3339]/50 border-[#236D5E]' : 'bg-[#332D3F]/50 border-[#5e4e99]'} border p-4 rounded-lg flex items-center justify-between`}>
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-3 ${status.connected ? 'bg-green-500' : 'bg-[#5e4e99]'}`}></div>
                    <div>
                      <p className="font-medium">WhatsApp {status.connected ? 'Connected' : 'Disconnected'}</p>
                      <p className="text-sm text-gray-300">
                        {status.connected 
                          ? 'Your mobile device is currently linked to this system.' 
                          : 'Scan the QR code with your WhatsApp mobile app to connect.'}
                      </p>
                    </div>
                  </div>
                  {/* {status.connected && (
                    <button 
                      onClick={handleLogout}
                      disabled={loading || logoutPolling}
                      className="bg-red-800/60 hover:bg-red-700/60 text-white px-4 py-2 rounded-md transition-colors duration-200 flex items-center"
                    >
                      <FaPowerOff className="mr-2" />
                      {loading ? 'Disconnecting...' : logoutPolling ? 'Waiting...' : 'Disconnect Device'}
                    </button>
                  )} */}
                </div>
              )}
            </div>
            
            {/* Device Connection and Send Message in same row using flexbox */}
            <div className="bg-[#121212] rounded-lg overflow-hidden border border-gray-700">
              <div className="bg-[#1C1B23] text-gray-300 text-sm font-medium py-3 px-4 border-b border-gray-700 flex justify-between items-center">
                <div className="flex items-center">
                  <FaMobile className="mr-2" />
                  <span>{status.connected ? 'DEVICE CONNECTED' : 'DEVICE CONNECTION'}</span>
                </div>
                {!status.connected && !loading && (
                  <button 
                    onClick={fetchQrCode} 
                    className="text-xs flex items-center text-gray-400 hover:text-gray-200"
                  >
                    <FaSync className="mr-1" />
                    Refresh QR
                  </button>
                )}
              </div>
              
              <div className="p-6">
                {!status.connected ? (
                  <div className="flex flex-row justify-between items-center gap-8">
                    {/* QR Code Container */}
                    <div className="flex-shrink-0">
                      {qrCode ? (
                        <div className="bg-white p-4 rounded-lg">
                          <QRCodeSVG value={qrCode} size={230} />
                        </div>
                      ) : (
                        <div className="w-[230px] h-[230px] bg-gray-800 rounded-lg flex items-center justify-center">
                          {logoutPolling ? (
                            <div className="text-center">
                              <div className="w-10 h-10 border-t-2 border-b-2 border-[#5D4C99] rounded-full animate-spin mx-auto mb-4"></div>
                              <p className="text-gray-400 text-sm">Generating new QR code...</p>
                            </div>
                          ) : (
                            <div className="text-center">
                              <FaQrcode className="text-gray-600 text-5xl mx-auto mb-4" />
                              <p className="text-gray-400 text-sm">QR code not available</p>
                              <button 
                                onClick={fetchQrCode} 
                                className="mt-4 bg-[#4A3C7F]/50 hover:bg-[#4A3C7F] text-white text-sm px-4 py-2 rounded transition-colors"
                              >
                                Refresh
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Connection Instructions */}
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-200 mb-4">Connect Your WhatsApp</h3>
                      <ol className="space-y-4 text-gray-300">
                        <li className="flex">
                          <span className="bg-[#4A3C7F] w-6 h-6 rounded-full flex items-center justify-center mr-3 flex-shrink-0">1</span>
                          <span>Open WhatsApp on your phone</span>
                        </li>
                        <li className="flex">
                          <span className="bg-[#4A3C7F] w-6 h-6 rounded-full flex items-center justify-center mr-3 flex-shrink-0">2</span>
                          <span>Tap Menu <b>⋮</b> or <b>Settings</b> and select <b>Linked Devices</b></span>
                        </li>
                        <li className="flex">
                          <span className="bg-[#4A3C7F] w-6 h-6 rounded-full flex items-center justify-center mr-3 flex-shrink-0">3</span>
                          <span>Tap on <b>Link a Device</b></span>
                        </li>
                        <li className="flex">
                          <span className="bg-[#4A3C7F] w-6 h-6 rounded-full flex items-center justify-center mr-3 flex-shrink-0">4</span>
                          <span>Point your phone camera at the QR code to scan it</span>
                        </li>
                      </ol>
                      
                      {error && (
                        <div className="mt-4 p-3 bg-red-900/30 text-red-400 rounded-md text-sm">
                          {error}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-row md:justify-between gap-8">
                    {/* Left side - Connected Device Info */}
                    <div className="md:w-[45%] flex flex-col md:flex-row items-start border-r border-gray-700 pr-4">
                      <div className="flex-shrink-0 mr-6 mb-4 md:mb-0 mx-auto md:mx-0">
                        <div className="w-20 h-20 rounded-full bg-[#1F3339]/50 border-4 border-[#236D5E] flex items-center justify-center">
                          <FaWhatsapp className="text-3xl text-green-500" />
                        </div>
                      </div>
                      
                      <div className="flex-1">
                        <h3 className="text-xl font-medium text-gray-200 mb-2 text-center md:text-left">WhatsApp Connected</h3>
                        <p className="text-gray-400 mb-6">
                          Your WhatsApp account is now linked to this system. You can send messages or use the AI assistant through WhatsApp.
                        </p>
                        
                        <button 
                          onClick={handleLogout}
                          disabled={loading || logoutPolling}
                          className="bg-red-800/60 hover:bg-red-700/60 text-white px-6 py-3 rounded-md transition-colors duration-200 flex items-center mx-auto md:mx-0"
                        >
                          <FaPowerOff className="mr-2" />
                          {loading ? 'Disconnecting...' : logoutPolling ? 'Waiting...' : 'Disconnect Device'}
                        </button>
                      </div>
                    </div>
                    
                    {/* Right side - Send Message Form */}
                    <div className="md:w-[50%] mt-6 md:mt-0 pl-0 md:pl-8  pt-6 md:pt-0">
                      <h3 className="text-lg font-medium text-gray-200 mb-4 flex items-center">
                        <FaPaperPlane className="mr-2 text-[#5D4C99]" />
                        Send Message
                      </h3>
                      
                      <form onSubmit={handleSendMessage} className="space-y-4">
                        <div>
                          <label htmlFor="number" className="block text-sm font-medium text-gray-300 mb-1">
                            Phone Number
                          </label>
                          <input
                            type="text"
                            id="number"
                            name="number"
                            placeholder="e.g. 911234567890 (with country code)"
                            className="w-full bg-[#1A1A1A] border border-gray-700 rounded py-2 px-3 text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#4A3C7F] focus:border-[#4A3C7F]"
                            value={messageInput.number}
                            onChange={handleInputChange}
                            disabled={loading}
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-1">
                            Message
                          </label>
                          <textarea
                            id="message"
                            name="message"
                            rows="5"
                            placeholder="Type your message here..."
                            className="w-full bg-[#1A1A1A] border border-gray-700 rounded py-2 px-3 text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#4A3C7F] focus:border-[#4A3C7F]"
                            value={messageInput.message}
                            onChange={handleInputChange}
                            disabled={loading}
                          ></textarea>
                        </div>
                        
                        {error && (
                          <div className="p-3 bg-red-900/30 text-red-400 rounded-md text-sm">
                            {error}
                          </div>
                        )}
                        
                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full py-2 px-4 rounded flex items-center justify-center bg-[#4A3C7F] hover:bg-[#5D4C99] text-white transition-colors"
                        >
                          {loading ? (
                            <>
                              <div className="w-4 h-4 border-t-2 border-b-2 border-white rounded-full animate-spin mr-2"></div>
                              Sending...
                            </>
                          ) : (
                            <>
                              <FaPaperPlane className="mr-2" />
                              Send Message
                            </>
                          )}
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default WhatsappControl;
