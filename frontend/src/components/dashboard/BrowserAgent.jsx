import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSend, FiRefreshCw, FiGlobe, FiCpu, FiMessageSquare } from 'react-icons/fi';

// Animation configurations
const messageAnimation = {
  hidden: { opacity: 0, y: 10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.3 }
  },
  exit: { 
    opacity: 0,
    transition: { duration: 0.2 }
  }
};

const TypewriterText = ({ text }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  
  useEffect(() => {
    if (currentIndex >= text.length) {
      setIsComplete(true);
      return;
    }
    
    const baseDelay = Math.min(text.length > 100 ? 5 : 20, 15);
    const randomDelay = Math.floor(Math.random() * 10) + baseDelay;
    
    const timer = setTimeout(() => {
      setDisplayedText(prev => prev + text[currentIndex]);
      setCurrentIndex(prev => prev + 1);
    }, randomDelay);
    
    return () => clearTimeout(timer);
  }, [text, currentIndex]);
  
  return (
    <>
      {displayedText}
      {currentIndex < text.length && (
        <motion.span 
          className="inline-block w-2 h-4 bg-gray-400"
          animate={{ opacity: [1, 0, 1] }}
          transition={{ repeat: Infinity, duration: 0.8 }}
        />
      )}
    </>
  );
};

const BrowserAgentInterface = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [awaitingAnswer, setAwaitingAnswer] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  
  const socketRef = useRef(null);
  const browserWindowRef = useRef(null);
  const terminalRef = useRef(null);
  
  const connectWebSocket = () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      const socket = new WebSocket('ws://localhost:8766'); // Different port for browser agent
      socketRef.current = socket;
      
      socket.onopen = () => {
        console.log('WebSocket connection established');
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        
        addMessage({ type: 'system', content: 'Connected to AI Browser Agent' });
        addMessage({ type: 'system', content: 'Ready for your web navigation tasks!' });
      };
      
      socket.onclose = (event) => {
        console.log(`WebSocket closed with code: ${event.code}, reason: ${event.reason}`);
        const wasConnected = isConnected;
        setIsConnected(false);
        setIsConnecting(false);
        if (wasConnected) {
          addMessage({ type: 'error', content: 'Connection to server closed' });
        }
      };
      
      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
        setIsConnecting(false);
        setError('Failed to connect to the server. Make sure the Python browser agent server is running.');
      };
      
      socket.onmessage = (event) => {
        if (!isConnected) {
          console.log('Message received but state shows disconnected. Fixing state.');
          setIsConnected(true);
        }
        handleSocketMessage(event);
      };
    } catch (err) {
      console.error('Error creating WebSocket:', err);
      setIsConnecting(false);
      setError(`Connection error: ${err.message}`);
    }
  };
  
  const handleSocketMessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      switch(data.type) {
        case 'screenshot':
          addMessage({ 
            type: 'screenshot', 
            content: data.content, 
            timestamp: new Date().toISOString() 
          });
          break;
          
        case 'question':
          setAwaitingAnswer(true);
          setCurrentQuestion(data.content);
          addMessage({ 
            type: 'question', 
            content: data.content,
          });
          break;
          
        case 'action':
          addMessage({ 
            type: 'action', 
            content: data.content,
          });
          break;
          
        case 'output':
          addMessage({ 
            type: 'output', 
            content: data.content,
          });
          break;
          
        case 'result':
          setIsProcessing(false);
          addMessage({ 
            type: 'result', 
            content: data.content,
          });
          break;
          
        case 'error':
          setIsProcessing(false);
          setAwaitingAnswer(false);
          addMessage({ 
            type: 'error', 
            content: `Error: ${data.content}`,
          });
          break;
          
        case 'system':
          addMessage({ 
            type: 'system', 
            content: data.content,
          });
          break;
          
        default:
          addMessage({ 
            type: data.type || 'output', 
            content: data.content,
          });
      }
    } catch (e) {
      console.error('Error parsing message:', e);
      addMessage({ type: 'output', content: event.data });
    }
    
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  };
  
  const addMessage = (message) => {
    setMessages(prev => [...prev, { ...message, id: Date.now() }]);
  };
  
  const sendTask = () => {
    if (!input.trim() || !isConnected || (isProcessing && !awaitingAnswer)) return;
    
    addMessage({ type: 'user-input', content: input });
    
    if (awaitingAnswer) {
      socketRef.current.send(JSON.stringify({ 
        type: 'answer',
        content: input 
      }));
      setAwaitingAnswer(false);
      setCurrentQuestion(null);
    } else {
      socketRef.current.send(JSON.stringify({ 
        type: 'task',
        content: input 
      }));
      setIsProcessing(true);
    }
    
    setInput('');
  };

  const handleReconnect = () => {
    if (socketRef.current) {
      socketRef.current.close();
    }
    
    connectWebSocket();
  };

  const handleInputChange = (e) => setInput(e.target.value);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && input.trim() && isConnected && (!isProcessing || awaitingAnswer)) {
      e.preventDefault();
      sendTask();
    }
  };
  
  useEffect(() => {
    connectWebSocket();
    
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);
  
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [messages]);
  
  useEffect(() => {
    const textarea = document.querySelector('textarea.browser-agent-input');
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);
  
  const renderMessage = (message) => {
    const { type, content, id } = message;
    
    switch(type) {
      case 'output':
        return (
          <div key={id} className="flex justify-start mb-4">
            <div className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 border border-gray-700 max-w-2xl">
              <div className="font-semibold mb-1 text-xs text-gray-500">Output</div>
              <div className="whitespace-pre-wrap font-mono">
                {content}
              </div>
            </div>
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
        
      case 'error':
        return (
          <div key={id} className="flex justify-start mb-4">
            <div className="px-4 py-2 rounded-lg bg-red-900/20 text-red-400 border border-red-800 max-w-2xl">
              <div className="font-semibold mb-1 text-xs text-red-500">Error</div>
              <div className="whitespace-pre-wrap font-mono">
                {content}
              </div>
            </div>
          </div>
        );
        
      case 'action':
        return (
          <div key={id} className="px-4 py-2 text-blue-300 my-2 border-l-2 border-blue-500 bg-blue-900/10">
            <div className="font-semibold mb-1 text-xs text-blue-400">Action</div>
            {content}
          </div>
        );
        
      case 'question':
        return (
          <div key={id} className="flex justify-start mb-4">
            <div className="px-4 py-2 rounded-lg bg-purple-900/20 text-purple-300 border border-purple-700 max-w-2xl">
              <div className="font-semibold mb-1 text-xs text-purple-500">Agent Question</div>
              <div className="whitespace-pre-wrap">
                {content}
              </div>
            </div>
          </div>
        );
        
      case 'system':
        return (
          <div key={id} className="px-4 py-2 text-yellow-300 text-center italic my-2">
            {content}
          </div>
        );
        
      case 'user-input':
        return (
          <div key={id} className="flex justify-end mb-4">
            <div className="px-4 py-2 rounded-lg bg-indigo-900/40 text-indigo-100 border border-indigo-700 max-w-2xl">
              <div className="font-semibold mb-1 text-xs text-indigo-500">You</div>
              <div>{content}</div>
            </div>
          </div>
        );
        
      case 'result':
        return (
          <div key={id} className="flex justify-start mb-4">
            <div className="px-4 py-2 rounded-lg bg-green-900/20 text-green-300 border border-green-700 max-w-2xl">
              <div className="font-semibold mb-1 text-xs text-green-500">Result</div>
              <div className="whitespace-pre-wrap">
                {content}
              </div>
            </div>
          </div>
        );
        
      default:
        return (
          <div key={id} className="px-6 py-2 text-gray-300 my-2">
            {content}
          </div>
        );
    }
  };
  
  const ConnectionStatusIndicator = () => {
    return (
      <div className="flex items-center space-x-2">
        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : isConnecting ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`}></div>
        <span className="text-sm text-gray-300">
          {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
        </span>
        {isConnected && messages.some(m => 
          m.type === 'system' && m.content.includes('Connected to AI Browser Agent')
        ) && (
          <span className="text-xs text-green-400">(Active)</span>
        )}
      </div>
    );
  };
  
  return (
    <div className="bg-black h-screen flex flex-col">
      <div className="px-6 py-2 bg-gray-800 border-t border-gray-700 flex justify-between items-center">
        <ConnectionStatusIndicator />
        
        <div className="flex items-center space-x-3">
          {!isConnected && !isConnecting && (
            <button 
              onClick={handleReconnect}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md flex items-center"
            >
              <FiRefreshCw className="mr-1" /> Reconnect
            </button>
          )}
        </div>
      </div>
      
      <div 
        ref={terminalRef}
        className="flex-1 overflow-y-auto bg-gray-900 text-gray-200 font-mono text-sm px-4"
      >
        {error && (
          <div className="bg-red-900/30 text-red-300 p-4 m-4 rounded-md border-l-4 border-red-500">
            {error}
          </div>
        )}
        
        {messages.length === 0 && !error && (
          <div className="p-8 text-center text-gray-500 italic">
            <FiGlobe className="mx-auto text-4xl mb-2" />
            <p>Enter a web task like "Search for latest tech news" to begin</p>
          </div>
        )}
        
        <div className="space-y-1 py-2 mb-4">
          {messages.map(renderMessage)}
        </div>
      </div>
      
      <div className="p-4 px-20 border-t border-gray-700">
        <div className="rounded-2xl bg-[#121212] border border-gray-700/50 overflow-hidden shadow-lg">
          {awaitingAnswer && (
            <div className="bg-purple-900/30 text-purple-300 text-xs px-4 py-1 border-b border-purple-800/50">
              The agent is waiting for your answer to continue.
            </div>
          )}
          <textarea
            className="browser-agent-input w-full bg-transparent border-0 text-gray-200 pt-4 px-6 focus:outline-none resize-none min-h-[20px] max-h-[200px] overflow-y-auto"
            placeholder={awaitingAnswer ? "Type your answer..." : "Enter a web task (e.g., 'Search for latest AI news')..."}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={!isConnected || (isProcessing && !awaitingAnswer)}
          />
          <div className="flex items-center px-6 py-4">
            {awaitingAnswer && (
              <div className="text-purple-400 text-xs flex items-center">
                <FiMessageSquare className="mr-1" />
                Answering question
              </div>
            )}
            <div className="flex-1"></div>
            <button
              onClick={sendTask}
              disabled={!input.trim() || !isConnected || (isProcessing && !awaitingAnswer)}
              className={`flex items-center justify-center w-8 h-8 rounded-full ${
                !input.trim() || !isConnected || (isProcessing && !awaitingAnswer)
                  ? "bg-gray-600 cursor-not-allowed"
                  : "bg-white hover:bg-gray-200"
              }`}
            >
              {isProcessing && !awaitingAnswer ? (
                <div className="w-4 h-4 border-t-2 border-gray-800 rounded-full animate-spin"></div>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-black" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          </div>
        </div>
        {isProcessing && !awaitingAnswer && (
          <div className="mt-2 text-xs text-indigo-400 animate-pulse">
            Browser agent is working on your task...
          </div>
        )}
      </div>
    </div>
  );
};

const BrowserAgent = () => {
  return (
    <div className="h-screen bg-gray-900">
      <BrowserAgentInterface />
    </div>
  );
};

export default BrowserAgent;
