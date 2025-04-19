import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { FiSend, FiRefreshCw, FiTerminal, FiCpu } from 'react-icons/fi';

// Animation configurations
const thinkingAnimation = {
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

const thoughtBubbleAnimation = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: { 
    scale: 1, 
    opacity: 1,
    transition: { type: "spring", stiffness: 500, damping: 30 }
  },
  exit: { 
    scale: 0.8, 
    opacity: 0,
    transition: { duration: 0.2 }
  }
};

const ThinkingIndicator = ({ isVisible }) => {
  const dots = ['.', '.', '.'];
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    if (!isVisible) return;
    
    const interval = setInterval(() => {
      setCount(prev => (prev + 1) % 4);
    }, 400);
    
    return () => clearInterval(interval);
  }, [isVisible]);
  
  if (!isVisible) return null;
  
  return (
    <motion.div 
      className="flex items-center space-x-2 text-indigo-400 text-sm font-medium py-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="w-4 h-4 relative">
        <motion.div 
          className="absolute inset-0 bg-indigo-500 rounded-full"
          animate={{ 
            scale: [1, 1.2, 1],
          }}
          transition={{ 
            repeat: Infinity,
            duration: 1.5,
            ease: "easeInOut"
          }}
        />
      </div>
      <span>Thinking{dots.slice(0, count).join('')}</span>
    </motion.div>
  );
};

const ThoughtBubble = ({ content, type, onComplete }) => {
  const bubbleRef = useRef(null);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onComplete) onComplete();
    }, content.length * 40 + 1000); // Duration based on content length
    
    return () => clearTimeout(timer);
  }, [content, onComplete]);

  const bubbleClasses = {
    thinking: "bg-gray-800 text-gray-300 border-gray-700",
    reasoning: "bg-indigo-900/30 text-indigo-200 border-indigo-700",
    action: "bg-purple-900/30 text-purple-200 border-purple-700",
  };
  
  return (
    <motion.div
      ref={bubbleRef}
      className={`rounded-lg p-3 my-2 border text-sm font-mono whitespace-pre-wrap ${bubbleClasses[type]}`}
      variants={thoughtBubbleAnimation}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <TypewriterText text={content} />
    </motion.div>
  );
};

const TypewriterText = ({ text }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  
  useEffect(() => {
    if (currentIndex >= text.length) return;
    
    const randomDelay = Math.floor(Math.random() * 30) + 10; // Random typing speed
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

const AITerminal = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  
  // Thinking process states
  const [thoughts, setThoughts] = useState([]);
  const [isThinking, setIsThinking] = useState(false);
  const [currentThoughtIndex, setCurrentThoughtIndex] = useState(0);
  
  const socketRef = useRef(null);
  const terminalRef = useRef(null);
  
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
        setError(null);
        
        addMessage({ type: 'system', content: 'Connected to AI Terminal Agent' });
        addMessage({ type: 'system', content: 'Ready for your commands!' });
      };
      
      socket.onclose = () => {
        setIsConnected(false);
        if (isConnected) {
          addMessage({ type: 'error', content: 'Connection to server closed' });
        }
      };
      
      socket.onerror = () => {
        setIsConnected(false);
        setIsConnecting(false);
        setError('Failed to connect to the server. Make sure the Python script is running.');
        
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
  
  const simulateThinkingProcess = (query) => {
    setIsThinking(true);
    setThoughts([]);
    setCurrentThoughtIndex(0);
    
    // Generate simulated thinking steps based on the query
    const thinkingSteps = [
      { 
        type: 'thinking', 
        content: `Analyzing query: "${query}"` 
      },
      { 
        type: 'reasoning', 
        content: `The user is asking about ${query.includes('file') ? 'file operations' : 'a general command'}. Let me think about the best approach...` 
      },
      { 
        type: 'action', 
        content: `I'll need to ${query.includes('search') ? 'search for relevant information' : 'execute a command'} to address this request.` 
      },
      { 
        type: 'reasoning', 
        content: `Considering the context and potential system constraints, I should proceed with caution and verify each step.` 
      }
    ];
    
    // Display thinking steps sequentially
    let delay = 20;
    thinkingSteps.forEach((thought, index) => {
      delay += 800 + Math.random() * 1200; // Random delay between thoughts
      setTimeout(() => {
        setThoughts(prev => [...prev, thought]);
        setCurrentThoughtIndex(index);
      }, delay);
    });
    
    // End thinking process
    setTimeout(() => {
      setIsThinking(false);
    }, delay + 1500);
  };
  
  const handleSocketMessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      switch(data.type) {
        case 'thinking':
        case 'reasoning':
          // Add to thinking process visualization
          setThoughts(prev => [...prev, { type: data.type, content: data.content }]);
          break;
        case 'command':
          setIsThinking(false);
          addMessage({ type: 'command', content: data.content });
          break;
        case 'output':
          try {
            const outputData = JSON.parse(data.content);
            const statusType = outputData.status === 'success' ? 'output' : 'error';
            addMessage({ type: statusType, content: outputData.result });
          } catch (e) {
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
          setIsProcessing(false);
          addMessage({ type: 'result', content: data.content });
          break;
        case 'error':
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
  
  // Add a message to the terminal
  const addMessage = (message) => {
    if (message.type === 'system' && 
        (message.content === 'Connected to AI Terminal Agent' || 
         message.content === 'Ready for your commands!')) {
      
      setMessages(prev => {
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
    
    // Simulate thinking process before sending to server
    simulateThinkingProcess(input);
    
    // Actually send to server
    socketRef.current.send(input);
    setInput('');
    setIsProcessing(true);
  };
  
  // Handle reconnect button click
  const handleReconnect = () => {
    setMessages(prev => prev.filter(m => 
      !(m.type === 'error' && 
        (m.content.includes('Connection to server closed') || 
         m.content.includes('WebSocket connection error'))
      )
    ));
    
    if (socketRef.current) {
      socketRef.current.close();
    }
    
    connectWebSocket();
  };
  
  // Connect on component mount
  useEffect(() => {
    connectWebSocket();
    
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
  }, [messages, thoughts]);
  
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
        <h1 className="text-3xl font-bold text-indigo-400 mb-2 flex items-center">
          <FiCpu className="mr-2" /> AI Terminal
        </h1>
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
          
          {/* Thinking process visualization */}
          {isThinking && (
            <motion.div 
              className="px-6 py-3 mx-4 my-2"
              variants={thinkingAnimation}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <ThinkingIndicator isVisible={isThinking} />
              
              <AnimatePresence>
                {thoughts.map((thought, index) => (
                  <ThoughtBubble 
                    key={index}
                    content={thought.content}
                    type={thought.type}
                    onComplete={index === thoughts.length - 1 ? () => {} : null}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
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
            {isProcessing ? 
              <div className="w-5 h-5 border-t-2 border-white rounded-full animate-spin"></div> : 
              <FiSend />
            }
          </button>
        </div>
        
        {isProcessing && !isThinking && (
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
