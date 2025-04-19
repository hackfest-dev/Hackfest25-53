import React, { useState, useEffect, useRef } from 'react';
import { FiSend, FiRefreshCw, FiCpu, FiGlobe, FiMessageSquare } from 'react-icons/fi';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar'; // Import Navbar component
import Sidebar from './Sidebar'; // Import Sidebar component

// WebSocket URL
const WEBSOCKET_URL = 'ws://localhost:6789';
// Fix path to use absolute URL or correct relative path
const AGENT_OUTPUT_PATH = `${window.location.origin}/features/main/worksbro/agent_output.json`;

const MultimodalAgent = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [awaitingUserInput, setAwaitingUserInput] = useState(false);
  const [agentConversation, setAgentConversation] = useState([]);
  const [pollErrorCount, setPollErrorCount] = useState(0);
  
  // Add sidebar state and location
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(location.pathname === '/analytics');

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);
  const processedMessagesRef = useRef(new Set());
  const lastPollTimeRef = useRef(Date.now());
  const connectingRef = useRef(false);

  // Toggle sidebar function
  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev);
  };

  // Connect to WebSocket server
  const connectWebSocket = () => {
    if (connectingRef.current) return;
    
    connectingRef.current = true;
    setIsConnecting(true);
    setError(null);

    try {
      if (socketRef.current && socketRef.current.readyState !== WebSocket.CLOSED) {
        socketRef.current.close();
      }

      const socket = new WebSocket(WEBSOCKET_URL);
      socketRef.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        connectingRef.current = false;
        setError(null);
        
        addMessage({ type: 'system', content: 'Connected to Multimodal AI Agent' });
        addMessage({ type: 'system', content: 'Type your request to begin a conversation' });
      };

      socket.onclose = (event) => {
        setIsConnected(false);
        setIsConnecting(false);
        connectingRef.current = false;
      };

      socket.onerror = (error) => {
        setIsConnected(false);
        setIsConnecting(false);
        connectingRef.current = false;
        setError('Failed to connect to the server. Make sure the agent server is running.');
      };

      socket.onmessage = handleSocketMessage;
    } catch (err) {
      setIsConnecting(false);
      connectingRef.current = false;
      setError(`Connection error: ${err.message}`);
    }
  };

  // Process WebSocket message
  const handleSocketMessage = (event) => {
    try {
      if (typeof event.data === 'string' && 
          (event.data.startsWith('Received') || 
           event.data.includes('command from client'))) {
        return;
      }
      
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (jsonError) {
        if (!event.data.includes('WebSocket') && 
            !event.data.includes('client connected') && 
            event.data.trim().length > 0) {
          addMessage({ 
            type: 'output', 
            content: event.data,
            agentName: 'System' 
          });
        }
        return;
      }
      
      if (data.messages && Array.isArray(data.messages)) {
        processAgentMessages(data.messages);
      } 
      else if (data.agent_name && data.agent_output) {
        processAgentMessage(data);
      }
      else if (data.type === 'agent_message' || data.type === 'output') {
        addMessage({ type: 'agent', content: data.content });
        setIsProcessing(false);
      } 
      else if (data.type === 'question' || (data.meta && data.meta.requires_input)) {
        setAwaitingUserInput(true);
        addMessage({ 
          type: 'question', 
          content: data.content || data.agent_output
        });
        setIsProcessing(false);
      }
      else if (data.type === 'error') {
        addMessage({ type: 'error', content: data.content });
        setIsProcessing(false);
      }
      else if (data.type === 'system') {
        addMessage({ type: 'system', content: data.content });
      }
      
      if (data.screenshot) {
        addMessage({ 
          type: 'screenshot', 
          content: data.screenshot
        });
      }
    } catch (e) {
      if (event.data && 
          event.data.length > 5 && 
          !event.data.includes('Received command') &&
          !event.data.includes('client connected')) {
        addMessage({ 
          type: 'output', 
          content: String(event.data).substring(0, 200)
        });
      }
    }
  };

  // Process messages from agent_output.json
  const processAgentMessages = (messages) => {
    setAgentConversation(messages);
    
    let hasNewMessages = false;
    
    messages.forEach(message => {
      const msgId = `${message.agent_name}-${message.agent_output.substring(0, 20)}`;
      
      if (!processedMessagesRef.current.has(msgId) && message.agent_output) {
        hasNewMessages = true;
        processedMessagesRef.current.add(msgId);
        processAgentMessage(message);
      }
    });
    
    if (hasNewMessages) {
      setIsProcessing(false);
    }
  };
  
  // Process individual agent message
  const processAgentMessage = (message) => {
    const { agent_name, agent_output } = message;
    
    if (!agent_output) return;
    
    if (agent_name === "user" && agent_output.startsWith("{")) {
      try {
        const parsed = JSON.parse(agent_output);
        if (parsed.type === "user_input" && parsed.content) {
          addMessage({ 
            type: 'user', 
            content: parsed.content,
            agentName: agent_name
          });
          return;
        }
      } catch (e) {}
    }
    
    if (agent_name === "WebSurfer" && agent_output.includes("Web surfing error")) {
      addMessage({ 
        type: 'error', 
        content: agent_output,
        agentName: agent_name
      });
      return;
    }
    
    addMessage({ 
      type: 'agent', 
      content: agent_output,
      agentName: agent_name
    });
  };

  // Add a message to the chat display
  const addMessage = (message) => {
    setMessages((prev) => {
      const isDuplicate = prev.some(m => 
        m.type === message.type && 
        m.content === message.content &&
        m.agentName === message.agentName
      );
      
      if (isDuplicate) return prev;
      return [...prev, { ...message, id: Date.now() }];
    });
  };

  // Send a message to the WebSocket server
  const sendMessage = () => {
    if (!input.trim() || !isConnected || (isProcessing && !awaitingUserInput)) return;

    addMessage({ type: 'user', content: input });
    
    const payload = {
      type: awaitingUserInput ? 'user_response' : 'user_input',
      content: input
    };
    
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    } else {
      addMessage({ type: 'error', content: "Cannot send message: WebSocket is not connected" });
    }
    
    if (!awaitingUserInput) {
      setIsProcessing(true);
    }
    
    setInput('');
    setAwaitingUserInput(false);
  };

  // Handle reconnect
  const handleReconnect = () => {
    clearInterval(pollRef.current);
    connectWebSocket();
    startPolling();
  };

  // Poll for updates to agent_output.json
  const pollAgentOutput = async () => {
    const now = Date.now();
    if (now - lastPollTimeRef.current < 1000) return;
    lastPollTimeRef.current = now;
    
    try {
      const response = await fetch(`${AGENT_OUTPUT_PATH}?t=${now}`, {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return;
      }
      
      const data = await response.json();
      if (data && data.messages && Array.isArray(data.messages)) {
        processAgentMessages(data.messages);
      }
    } catch (err) {
      setPollErrorCount(prev => prev + 1);
      if (pollErrorCount > 5) {
        stopPolling();
      }
    }
  };

  // Start polling with better error handling
  const startPolling = () => {
    stopPolling();
    setPollErrorCount(0);
    fetch(AGENT_OUTPUT_PATH, { method: 'HEAD' })
      .then(response => {
        if (response.ok) {
          pollRef.current = setInterval(pollAgentOutput, 2000);
        }
      })
      .catch(err => {});
  };

  // Stop polling
  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  // Component mount effect
  useEffect(() => {
    connectWebSocket();
    startPolling();
    
    return () => {
      stopPolling();
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Add a direct command processor component
  const CommandProcessor = () => {
    const isCommand = (message) => {
      return message.includes('Executing:') || 
             message.includes('Running command:') ||
             message.includes('Command output:');
    };

    useEffect(() => {
      const handleCommand = (event) => {
        if (typeof event.data === 'string' && isCommand(event.data)) {
          addMessage({
            type: 'command',
            content: event.data.replace(/^(Executing:|Running command:)\s*/, ''),
            agentName: 'System'
          });
        }
      };

      if (socketRef.current) {
        socketRef.current.addEventListener('message', handleCommand);
        return () => socketRef.current?.removeEventListener('message', handleCommand);
      }
    }, [socketRef.current]);

    return null;
  };

  // Auto-resize textarea effect
  useEffect(() => {
    const textarea = document.querySelector('textarea');
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Render a message based on its type
  const renderMessage = (message) => {
    const { type, content, id, agentName } = message;
    
    switch(type) {
      case 'user':
        return (
          <div key={id} className="flex justify-end mb-4">
            <div className="px-4 py-2 rounded-lg bg-indigo-900/40 text-indigo-100 border border-indigo-700 max-w-2xl">
              <div className="font-semibold mb-1 text-xs text-indigo-500">You</div>
              <div className="whitespace-pre-wrap">{content}</div>
            </div>
          </div>
        );
        
      case 'agent':
        return (
          <div key={id} className="flex justify-start mb-4">
            <div className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 border border-gray-700 max-w-2xl">
              <div className="font-semibold mb-1 text-xs text-gray-500 flex items-center">
                <span className="bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded text-xs mr-2">
                  {agentName || "Agent"}
                </span>
              </div>
              <div className="whitespace-pre-wrap">{content}</div>
            </div>
          </div>
        );
        
      case 'question':
        return (
          <div key={id} className="flex justify-start mb-4">
            <div className="px-4 py-2 rounded-lg bg-purple-900/20 text-purple-300 border border-purple-700 max-w-2xl">
              <div className="font-semibold mb-1 text-xs text-purple-500">Agent Question</div>
              <div className="whitespace-pre-wrap">{content}</div>
            </div>
          </div>
        );
        
      case 'error':
        return (
          <div key={id} className="flex justify-start mb-4">
            <div className="px-4 py-2 rounded-lg bg-red-900/20 text-red-400 border border-red-800 max-w-2xl">
              <div className="font-semibold mb-1 text-xs text-red-500">
                {agentName ? `${agentName} Error` : "Error"}
              </div>
              <div className="whitespace-pre-wrap font-mono text-sm">{content}</div>
            </div>
          </div>
        );
        
      case 'system':
        return (
          <div key={id} className="px-4 py-2 text-purple-300 text-center italic my-2">
            {content}
          </div>
        );
      
      case 'screenshot':
        return (
          <div key={id} className="flex justify-start mb-4">
            <div className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 border border-gray-700">
              <div className="font-semibold mb-1 text-xs text-gray-500">Browser Screenshot</div>
              <img 
                src={`data:image/png;base64,${content}`} 
                alt="Browser Screenshot" 
                className="max-w-full rounded" 
                style={{ maxHeight: '400px' }}
              />
            </div>
          </div>
        );
        
      case 'command':
        return (
          <div key={id} className="flex justify-start mb-4">
            <div className="px-4 py-2 rounded-lg bg-green-900/20 text-green-300 border border-green-700 max-w-2xl">
              <div className="font-semibold mb-1 text-xs text-green-500">Command Output</div>
              <div className="whitespace-pre-wrap">{content}</div>
            </div>
          </div>
        );
        
      default:
        return (
          <div key={id} className="px-4 py-2 text-gray-300 my-2">
            {content}
          </div>
        );
    }
  };

  return (
    <div className="h-screen flex flex-col bg-black">
      <Navbar toggleSidebar={toggleSidebar} />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar isOpen={sidebarOpen} />
        
        <div className="flex-1 overflow-hidden bg-black">
          <div className="px-3 py-2 bg-black border-b border-gray-700 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : isConnecting ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-sm text-gray-300">
                {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
              </span>
              {isProcessing && (
                <span className="text-xs text-blue-300 animate-pulse ml-2">
                  Processing...
                </span>
              )}
            </div>
            
            <button
              onClick={handleReconnect}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md flex items-center"
              disabled={isConnecting}
            >
              <FiRefreshCw className={`mr-1.5 ${isConnecting ? 'animate-spin' : ''}`} /> 
              {isConnecting ? 'Connecting...' : 'Reconnect'}
            </button>
          </div>

          <CommandProcessor />

          <div className="flex-1 overflow-y-auto bg-black text-gray-200 font-mono text-sm px-4 py-4" style={{ height: 'calc(100vh - 160px)' }}>
            {/* Add debug information in development mode */}
            {process.env.NODE_ENV === 'development' && error && (
              <div className="bg-yellow-900/30 text-yellow-300 p-2 text-xs mb-4 rounded font-mono">
                Debug: WebSocket {isConnected ? 'connected' : 'disconnected'}, 
                Polling {pollRef.current ? 'active' : 'inactive'}
              </div>
            )}
            
            {error && (
              <div className="bg-red-900/30 text-red-300 p-4 m-4 rounded-md border-l-4 border-red-500">
                {error}
              </div>
            )}
            
            {messages.length === 0 && !error && (
              <div className="p-8 text-center text-gray-500 italic">
                <FiGlobe className="mx-auto text-4xl mb-2" />
                <p>Type a request to begin your conversation with the multimodal agent</p>
              </div>
            )}
            
            {messages.map(renderMessage)}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-2 md:p-4 md:px-10 lg:px-20 border-t border-gray-700">
            <div className="rounded-2xl bg-[#121212] border border-gray-700/50 overflow-hidden shadow-lg">
              {awaitingUserInput && (
                <div className="bg-purple-900/30 text-purple-300 text-xs px-4 py-1 border-b border-purple-800/50">
                  The agent is waiting for your response to continue.
                </div>
              )}
              <textarea
                className="w-full bg-transparent border-0 text-gray-200 pt-3 px-4 focus:outline-none resize-none min-h-[20px] max-h-[200px] overflow-y-auto"
                placeholder={awaitingUserInput 
                  ? "Type your response to the agent's question..." 
                  : "Type your request to the multimodal agent..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                disabled={!isConnected || (isProcessing && !awaitingUserInput)}
              />
              <div className="flex items-center px-4 py-3">
                <div className="flex-1">
                  {awaitingUserInput && (
                    <div className="text-purple-400 text-xs">
                      Answering agent's question
                    </div>
                  )}
                  {isProcessing && !awaitingUserInput && (
                    <div className="text-blue-400 text-xs animate-pulse">
                      Agent is processing...
                    </div>
                  )}
                </div>
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || !isConnected || (isProcessing && !awaitingUserInput)}
                  className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    !input.trim() || !isConnected || (isProcessing && !awaitingUserInput)
                      ? "bg-gray-600 cursor-not-allowed"
                      : "bg-white hover:bg-gray-200"
                  }`}
                >
                  {isProcessing && !awaitingUserInput ? (
                    <div className="w-4 h-4 border-t-2 border-gray-800 rounded-full animate-spin"></div>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-black" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultimodalAgent;
