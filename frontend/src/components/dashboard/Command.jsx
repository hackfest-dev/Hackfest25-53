import React, { useState, useEffect, useRef } from 'react';
import { FiSend, FiRefreshCw, FiTerminal, FiMic, FiMicOff } from 'react-icons/fi';

const AITerminal = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [isCollectingTokens, setIsCollectingTokens] = useState(false);
  const [tokenBuffer, setTokenBuffer] = useState('');
  
  const socketRef = useRef(null);
  const terminalRef = useRef(null);
  const tokenContainerRef = useRef(null);
  
  // Connect to WebSocket
  const connectWebSocket = () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      const socket = new WebSocket('ws://localhost:8765');
      socketRef.current = socket;
      
      socket.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        setError(null); // Clear any existing error
        
        // Clear connection error messages
        setMessages(prev => prev.filter(m => 
          !(m.type === 'error' && 
            (m.content.includes('Connection to server closed') || 
             m.content.includes('WebSocket connection error'))
          )
        ));
        
        addMessage({ type: 'system', content: 'Connected to AI Terminal Agent' });
        addMessage({ type: 'system', content: 'Ready for your commands!' });
      };
      
      socket.onclose = () => {
        setIsConnected(false);
        // Only add disconnection message if we were previously connected
        // to avoid duplicate messages
        if (isConnected) {
          addMessage({ type: 'error', content: 'Connection to server closed' });
        }
      };
      
      socket.onerror = (event) => {
        setIsConnected(false);
        setIsConnecting(false);
        setError('Failed to connect to the server. Make sure the Python script is running.');
        
        // Only add error message if it doesn't already exist
        const errorExists = messages.some(m => 
          m.type === 'error' && m.content === 'WebSocket connection error'
        );
        
        if (!errorExists) {
          addMessage({ type: 'error', content: 'WebSocket connection error' });
        }
      };
      
      socket.onmessage = handleSocketMessage;
    } catch (err) {
      setIsConnecting(false);
      setError(`Connection error: ${err.message}`);
    }
  };
  
  const handleSocketMessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      switch(data.type) {
        case 'token':
          handleToken(data.content);
          break;
        case 'thinking':
        case 'reasoning':
          startTokenCollection();
          appendToTokenContainer(data.content);
          break;
        case 'command':
          endTokenCollection();
          addMessage({ type: 'command', content: data.content });
          break;
        case 'output':
          try {
            // Try to parse as JSON for structured command output
            const outputData = JSON.parse(data.content);
            const statusType = outputData.status === 'success' ? 'output' : 'error';
            addMessage({ type: statusType, content: outputData.result });
          } catch (e) {
            // If not JSON, display as regular output
            addMessage({ type: 'output', content: data.content });
          }
          break;
        case 'verbose':
          addMessage({ type: 'verbose', content: data.content });
          break;
        case 'action':
          addMessage({ type: 'action', content: data.content });
          break;
        case 'result':
          endTokenCollection();
          setIsProcessing(false);
          addMessage({ type: 'result', content: data.content });
          break;
        case 'error':
          endTokenCollection();
          setIsProcessing(false);
          addMessage({ type: 'error', content: `Error: ${data.content}` });
          break;
        case 'system':
          addMessage({ type: 'system', content: data.content });
          break;
        default:
          addMessage({ type: data.type || 'output', content: data.content });
      }
    } catch (e) {
      console.error('Error parsing message:', e);
      addMessage({ type: 'output', content: event.data });
    }
    
    // Auto-scroll to the bottom
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  };
  
  const startTokenCollection = () => {
    if (!isCollectingTokens) {
      setIsCollectingTokens(true);
      setTokenBuffer('');
      
      // Create a new token container element
      const newMessage = { 
        id: Date.now(), 
        type: 'reasoning-container', 
        content: ''
      };
      
      setMessages(prev => [...prev, newMessage]);
      tokenContainerRef.current = newMessage.id;
    }
  };
  
  const appendToTokenContainer = (content) => {
    if (isCollectingTokens && tokenContainerRef.current) {
      setTokenBuffer(prev => prev + content);
      
      // Update the specific message with the token container ID
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tokenContainerRef.current 
            ? { ...msg, content: (msg.content || '') + content } 
            : msg
        )
      );
    }
  };
  
  const handleToken = (token) => {
    if (!isCollectingTokens) {
      startTokenCollection();
    }
    appendToTokenContainer(token);
  };
  
  const endTokenCollection = () => {
    setIsCollectingTokens(false);
    setTokenBuffer('');
    tokenContainerRef.current = null;
  };
  
  // Add a message to the terminal
  const addMessage = (message) => {
    // For system connection messages, remove any duplicates
    if (message.type === 'system' && 
        (message.content === 'Connected to AI Terminal Agent' || 
         message.content === 'Ready for your commands!')) {
      
      setMessages(prev => {
        // Remove existing identical system messages
        const filtered = prev.filter(m => 
          !(m.type === 'system' && m.content === message.content)
        );
        return [...filtered, { ...message, id: Date.now() }];
      });
    } else {
      setMessages(prev => [...prev, { ...message, id: Date.now() }]);
    }
  };
  
  // Send a command to the WebSocket server
  const sendCommand = () => {
    if (!input.trim() || !isConnected || isProcessing) return;
    
    addMessage({ type: 'command', content: input });
    socketRef.current.send(input);
    setInput('');
    setIsProcessing(true);
    
    // Clear any previous token collection
    endTokenCollection();
  };
  
  // Handle reconnect button click
  const handleReconnect = () => {
    // Clear messages related to connection status
    setMessages(prev => prev.filter(m => 
      !(m.type === 'error' && 
        (m.content.includes('Connection to server closed') || 
         m.content.includes('WebSocket connection error'))
      )
    ));
    
    // Close existing socket if any
    if (socketRef.current) {
      socketRef.current.close();
    }
    
    // Try to reconnect
    connectWebSocket();
  };
  
  // Connect on component mount
  useEffect(() => {
    connectWebSocket();
    
    // Cleanup WebSocket on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);
  
  // Auto-scroll when messages change
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [messages]);
  
  // Render a message based on its type
  const renderMessage = (message) => {
    const { type, content, id } = message;
    
    switch(type) {
      case 'command':
        return (
          <div key={id} className="px-4 py-2 font-semibold text-green-400 border-b border-gray-800">
            <span className="text-gray-400 mr-2">$</span>{content}
          </div>
        );
      case 'output':
        return (
          <div key={id} className="px-6 py-2 text-gray-300 whitespace-pre-wrap font-mono">
            {content}
          </div>
        );
      case 'error':
        return (
          <div key={id} className="px-6 py-2 text-red-400 whitespace-pre-wrap font-mono bg-red-900/20 border-l-2 border-red-500">
            {content}
          </div>
        );
      case 'verbose':
        return (
          <div key={id} className="px-6 py-1 text-blue-300 text-sm opacity-70">
            {content}
          </div>
        );
      case 'action':
        return (
          <div key={id} className="px-6 py-1 text-purple-300 text-sm italic">
            {content}
          </div>
        );
      case 'system':
        return (
          <div key={id} className="px-4 py-2 text-yellow-300 text-center italic">
            {content}
          </div>
        );
      case 'result':
        return (
          <div key={id} className="px-6 py-2 text-green-300 font-semibold border-l-2 border-green-500 bg-green-900/20">
            ✓ {content}
          </div>
        );
      case 'reasoning-container':
        return (
          <div key={id} className="px-6 py-3 text-gray-400 font-mono text-sm bg-gray-800/50 rounded my-2 mx-4 whitespace-pre-wrap">
            {content}
          </div>
        );
      default:
        return (
          <div key={id} className="px-6 py-2 text-gray-300">
            {content}
          </div>
        );
    }
  };
  
  return (
    <div className="bg-gray-900 h-screen flex flex-col">
      <div className="p-6 pb-4 bg-gray-800">
        <h1 className="text-3xl font-bold text-indigo-400 mb-2">AI Terminal</h1>
        <p className="text-gray-400">
          Execute commands or ask questions using natural language. The AI agent will help you accomplish tasks.
        </p>
      </div>
      
      {/* Connection status */}
      <div className="px-6 py-2 bg-gray-800 border-t border-gray-700 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : isConnecting ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="text-sm text-gray-300">
            {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
          </span>
        </div>
        
        {!isConnected && !isConnecting && (
          <button 
            onClick={handleReconnect}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md flex items-center"
          >
            <FiRefreshCw className="mr-1" /> Reconnect
          </button>
        )}
      </div>
      
      {/* Main terminal */}
      <div 
        ref={terminalRef}
        className="flex-1 overflow-y-auto bg-gray-900 text-gray-200 font-mono text-sm"
      >
        {error && (
          <div className="bg-red-900/30 text-red-300 p-4 m-4 rounded-md border-l-4 border-red-500">
            {error}
          </div>
        )}
        
        {messages.length === 0 && !error && (
          <div className="p-8 text-center text-gray-500 italic">
            <FiTerminal className="mx-auto text-4xl mb-2" />
            <p>Type a command or question to begin</p>
          </div>
        )}
        
        <div className="space-y-1 py-2">
          {messages.map(renderMessage)}
        </div>
      </div>
      
      {/* Input area */}
      <div className="p-4 bg-gray-800 border-t border-gray-700">
        <div className="flex rounded-md bg-gray-700 overflow-hidden">
          <span className="bg-gray-800 px-3 flex items-center text-gray-400">$</span>
          <input
            type="text"
            className="flex-1 bg-transparent border-0 text-gray-200 p-3 focus:outline-none font-mono"
            placeholder="Type a command or question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendCommand()}
            disabled={!isConnected || isProcessing}
          />
          <button
            onClick={sendCommand}
            disabled={!input.trim() || !isConnected || isProcessing}
            className={`px-4 text-white flex items-center ${
              !input.trim() || !isConnected || isProcessing 
                ? 'bg-gray-600 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {isProcessing ? <div className="w-5 h-5 border-t-2 border-white rounded-full animate-spin"></div> : <FiSend />}
          </button>
        </div>
        
        {isProcessing && (
          <div className="mt-2 text-xs text-indigo-400 animate-pulse">
            AI is processing your request...
          </div>
        )}
      </div>
    </div>
  );
};

const Command = () => {
  return (
    <div className="h-screen bg-gray-900">
      <AITerminal />
    </div>
  );
};

export default Command;
