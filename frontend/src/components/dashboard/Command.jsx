import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { FiSend, FiRefreshCw, FiTerminal, FiCpu } from 'react-icons/fi';
import { useLocation } from 'react-router-dom';
import api from '../../services/api'; // Import the API service
import Navbar from './Navbar'; // Import Navbar component
import Sidebar from './Sidebar'; // Import Sidebar component

// Custom scrollbar styles
const scrollbarStyles = `
  .terminal-scroll::-webkit-scrollbar {
    width: 4px;
    background: transparent;
  }
  
  .terminal-scroll::-webkit-scrollbar-thumb {
    background: rgba(76, 61, 139, 0.5);
    border-radius: 4px;
  }
  
  .terminal-scroll::-webkit-scrollbar-thumb:hover {
    background: rgba(94, 78, 153, 0.7);
  }
  
  .terminal-scroll::-webkit-scrollbar-track {
    background: #1a1a1a;
    border-radius: 4px;
  }
  
  .terminal-scroll {
    scrollbar-width: thin;
    scrollbar-color: rgba(76, 61, 139, 0.5) transparent;
  }
`;

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

// Update ThinkingIndicator to look more like a terminal cursor
const ThinkingIndicator = ({ isVisible }) => {
  const [blink, setBlink] = useState(true);
  
  useEffect(() => {
    if (!isVisible) return;
    
    const interval = setInterval(() => {
      setBlink(prev => !prev);
    }, 500);
    
    return () => clearInterval(interval);
  }, [isVisible]);
  
  if (!isVisible) return null;
  
  return (
    <div className="flex items-center py-1 text-gray-300 text-sm">
      <span className="text-green-400 mr-1">$</span>
      <span className="mr-1">thinking</span>
      <span className={`inline-block w-2 h-4 ${blink ? 'bg-gray-400' : 'bg-transparent'}`}></span>
    </div>
  );
};

// Update ThoughtBubble component to look like terminal output
const ThoughtBubble = ({ content, type, onComplete }) => {
  const bubbleRef = useRef(null);

  // Terminal styling based on type
  let terminalPrompt = "$ ";
  let promptColor = "text-green-400";

  if (type === 'thinking') {
    terminalPrompt = "# ";
    promptColor = "text-blue-400";
  } else if (type === 'reasoning') {
    terminalPrompt = "> ";
    promptColor = "text-indigo-400";
  } else if (type === 'action') {
    terminalPrompt = "$ ";
    promptColor = "text-green-400";
  }

  // Special highlighting for command-related thoughts
  const isCommandRelated = content.includes("Executing:") || 
                           content.includes("Using tool: terminal") ||
                           content.toLowerCase().includes("command");
  
  return (
    <motion.div
      ref={bubbleRef}
      className="mb-2"
      variants={thoughtBubbleAnimation}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <div className="flex">
        <span className={`${promptColor} mr-2 flex-shrink-0`}>{terminalPrompt}</span>
        <div className="text-sm font-mono whitespace-pre-wrap text-gray-300">
          <TypewriterText text={content} />
        </div>
      </div>
    </motion.div>
  );
};

// Add new TerminalHeader component for the thinking section
const TerminalHeader = ({ title = "AI Thinking Process" }) => {
  return (
    <div className="bg-gray-900 border-b border-gray-700 p-1 flex items-center">
      <div className="flex space-x-1.5 ml-2">
        <div className="w-3 h-3 rounded-full bg-red-500"></div>
        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
        <div className="w-3 h-3 rounded-full bg-green-500"></div>
      </div>
      <div className="flex-1 text-center text-xs text-gray-400 font-mono">{title}</div>
    </div>
  );
};

const CodeBlockFormatter = ({ content }) => {
  if (content.includes('```')) {
    const parts = content.split(/```(\w*)/);
    
    let language = "javascript";
    const langMatch = content.match(/```(\w+)/);
    if (langMatch && langMatch[1]) {
      language = langMatch[1];
    }
    
    return (
      <div className="w-full">
        {parts[0] && <div className="mb-2">{parts[0]}</div>}
        
        {content.includes('```') && (
          <div className="rounded-md overflow-hidden">
            <div className="bg-gray-700 px-4 py-1 text-xs text-gray-300 border-b border-gray-600 flex justify-between">
              <span>{language}</span>
              <span className="opacity-50">code</span>
            </div>
            
            <pre className="p-4 bg-gray-800 rounded-b-md overflow-x-auto">
              <code className="text-sm text-gray-300 font-mono">
                {content.match(/```(?:\w*\n)?([\s\S]*?)```/)?.[1] || ''}
              </code>
            </pre>
          </div>
        )}
        
        {parts[parts.length-1] && !parts[parts.length-1].match(/```/) && (
          <div className="mt-2">{parts[parts.length-1]}</div>
        )}
      </div>
    );
  }
  
  return <span>{content}</span>;
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
  
  if (text.includes('```') && isComplete) {
    return <CodeBlockFormatter content={text} />;
  }
  
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

const cleanThoughtText = (text) => {
  const cleanedText = text.replace(/\u001b\[\d+;?\d*m/g, '')
    .replace(/\[\d+;?\d*m/g, '')
    .replace(/\[0m/g, '')
    .replace(/\[\d+;\d+;\d+m/g, '')
    .replace(/\[\d+;\d+m\[\d+;\d+m/g, '')
    .replace(/^Thought:\s*/i, '')
    .replace(/Observing results.../g, '')
    .trim();
  
  return cleanedText;
};

const containsJsonActionPattern = (content) => {
  if (typeof content !== 'string') return false;
  
  const hasActionPattern = content.includes('"action"') && content.includes('"action_input"');
  
  const looksLikeJson = 
    (content.trim().startsWith('{') || content.includes('{"action"')) && 
    (content.includes('"terminal"') || content.includes('"action_input"'));
    
  return hasActionPattern || looksLikeJson;
};

const AITerminal = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  
  const [thoughts, setThoughts] = useState([]);
  const [isThinking, setIsThinking] = useState(false);
  const [showThinking, setShowThinking] = useState(true);
  const [calendarMode, setCalendarMode] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  
  const socketRef = useRef(null);
  const terminalRef = useRef(null);
  
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
          // addMessage({ type: 'error', content: 'WebSocket connection error' });
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
    
    const thinkingSteps = [
      { 
        type: 'thinking', 
        content: `Analyzing query: "${query}"` 
      }
    ];
    
    setThoughts(thinkingSteps);
  };
  
  const handleSocketMessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      if (data.type === 'verbose' && (
        data.content.includes('Entering new AgentExecutor chain') ||
        data.content.includes('Finished chain') ||
        data.content.includes('[0m') ||
        data.content.includes('[32;1m') ||
        data.content.includes('[1;3m') ||
        data.content.includes('Thought:') ||
        data.content.includes('Action:') ||
        data.content.includes('Final Answer:') ||
        data.content.trim() === '' ||
        /^\s*\[\d+;\d+m\s*$/.test(data.content) ||
        data.content.includes('"action"') ||
        data.content.includes('"action_input"') ||
        data.content.trim().startsWith('{') ||
        data.content.trim().endsWith('}') ||
        containsJsonActionPattern(data.content) ||
        data.content.trim() === '```' ||
        data.content.trim().startsWith('```{')
      )) {
        return;
      }
      
      if (containsJsonActionPattern(data.content)) {
        return;
      }
      
      if (data.type === 'result' && calendarMode) {
        setIsProcessing(false);
        setIsThinking(false);
        setCalendarMode(false);
        
        addMessage({ 
          type: 'result', 
          content: data.content,
          isCalendarEvent: true
        });
        return;
      }
      
      switch(data.type) {
        case 'clear_thinking':
          setIsThinking(false);
          break;
          
        case 'thinking_step':
          setThoughts(prev => [...prev, { 
            type: 'thinking', 
            content: cleanThoughtText(data.content),
            timestamp: Date.now() 
          }]);
          setIsThinking(true);
          break;

        case 'reasoning_step':
          setThoughts(prev => {
            const newThoughts = [...prev];
            if (newThoughts.length >= 20) {
              newThoughts.shift();
            }
            return [...newThoughts, { 
              type: 'reasoning', 
              content: cleanThoughtText(data.content),
              timestamp: Date.now()
            }];
          });
          setIsThinking(true);
          break;

        case 'action_step':
          setThoughts(prev => {
            const newThoughts = [...prev];
            if (newThoughts.length >= 20) {
              newThoughts.shift();
            }
            return [...newThoughts, { 
              type: 'action', 
              content: cleanThoughtText(data.content),
              timestamp: Date.now()
            }];
          });
          setIsThinking(true);
          break;
          
        case 'token':
          break;
        case 'command':
          if (containsJsonActionPattern(data.content)) {
            const match = data.content.match(/"action_input":\s*"([^"]+)"/);
            if (match) {
              data.content = match[1].replace(/\\"/g, '"');
            } else {
              return;
            }
          }
          
          setThoughts(prev => [...prev, { 
            type: 'action', 
            content: `Executing command: ${data.content}`,
            timestamp: Date.now()
          }]);
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
          setIsThinking(false);
          
          let formattedContent = data.content;
          
          if (formattedContent.startsWith('[32;1m') || 
              formattedContent.startsWith('Thought:') ||
              formattedContent.startsWith('[1;3m')) {
            
            const cleanMatch = formattedContent.match(/(?:Thought:|Final Answer:)?(.*)/s);
            if (cleanMatch && cleanMatch[1]) {
              formattedContent = cleanMatch[1].trim();
            }
          }
          
          addMessage({ type: 'result', content: formattedContent });
          break;
        case 'error':
          setIsProcessing(false);
          setIsThinking(false);
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
    
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  };
  
  const addMessage = (message) => {
    // Don't add welcome messages if user has already interacted with the terminal
    if (hasUserInteracted && 
        message.type === 'system' && 
        (message.content === 'Connected to AI Terminal Agent' || 
         message.content === 'Ready for your commands!')) {
      return; // Skip adding these messages once user has interacted
    }
    
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
  
  const sendCommand = async () => {
    if (!input.trim() || !isConnected || isProcessing) return;
    
    // Mark that user has interacted with the terminal
    setHasUserInteracted(true);
    
    // Add user message to the chat
    addMessage({ type: 'user-input', content: input });
    
    // Handle input based on current mode
    if (calendarMode) {
      // In calendar mode, handle as calendar event creation using API directly
      setThoughts([
        { 
          type: 'thinking', 
          content: `Creating calendar event: "${input}"`,
          timestamp: Date.now()
        }
      ]);
      
      setIsThinking(true);
      setIsProcessing(true);
      
      try {
        // Call the calendar API directly instead of sending through WebSocket
        const calendarResponse = await api.post('/calendar/events/natural', { text: input });
        
        if (calendarResponse.data.success) {
          const eventDetails = calendarResponse.data.event;
          // Format successful calendar creation message
          const successMessage = `✅ Event created: ${eventDetails.summary}
Start: ${new Date(eventDetails.start.dateTime).toLocaleString()}
End: ${new Date(eventDetails.end.dateTime).toLocaleString()}

View in Google Calendar: ${calendarResponse.data.calendarLink}`;
          
          // Add as a result message (green box)
          addMessage({ 
            type: 'result', 
            content: successMessage,
            isCalendarEvent: true
          });
          
          // Turn off calendar mode after successful creation
          setCalendarMode(false);
        } else {
          // Should not happen but handle just in case
          throw new Error('Failed to create calendar event');
        }
      } catch (error) {
        // Handle calendar authorization errors
        if (error.response?.status === 401 && error.response?.data?.authUrl) {
          const authUrl = error.response?.data?.authUrl;
          
          // Create error message with link
          const authMessage = `Calendar authorization required. [Open authorization page](${authUrl})`;
          
          addMessage({ 
            type: 'error', 
            content: `Error: Calendar authorization required.`,
            authUrl
          });
          
          // Also add system message explaining what to do
          addMessage({
            type: 'system',
            content: 'You need to authorize access to your Google Calendar. Click the "Open Authorization Page" button below.'
          });
          
          // Create a special auth action message
          addMessage({
            type: 'calendar-auth',
            content: 'Authorize Calendar Access',
            authUrl
          });
        } else {
          // For other errors
          addMessage({ 
            type: 'error', 
            content: `Error creating calendar event: ${error.response?.data?.error || error.message}` 
          });
        }
      } finally {
        setIsProcessing(false);
        setIsThinking(false);
      }
    } else {
      // Regular processing through WebSocket
      simulateThinkingProcess(input);
      socketRef.current.send(input);
      setIsProcessing(true);
    }
    
    setInput('');
  };
  
  const toggleCalendarMode = () => {
    setCalendarMode(prev => !prev);
    if (!calendarMode) {
      addMessage({ 
        type: 'system', 
        content: 'Calendar mode activated. Your next input will be processed as a calendar event.' 
      });
    } else {
      addMessage({ 
        type: 'system', 
        content: 'Calendar mode deactivated. Returning to normal operation.' 
      });
    }
  };

  const handleReconnect = () => {
    setMessages(prev => prev.filter(m => 
      !(m.type === 'error' && 
        (m.content.includes('Connection to server closed') || 
         m.content.includes('WebSocket connection error'))
      )
    ));
    
    // When reconnecting, we should preserve the hasUserInteracted state
    // so welcome messages don't reappear
    if (socketRef.current) {
      socketRef.current.close();
    }
    
    connectWebSocket();
  };

  const handleInputChange = (e) => setInput(e.target.value);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && input.trim() && isConnected && !isProcessing) {
      sendCommand(input);
    }
  };
  
  const handleSend = () => {
    if (input.trim() && isConnected && !isProcessing) {
      sendCommand(input);
    }
  };

  const openAuthUrl = (url) => {
    window.open(url, '_blank');
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
  }, [messages, thoughts]);
  
  // Also filter welcome messages from initial rendering
  const filteredMessages = hasUserInteracted 
    ? messages.filter(m => !(
        m.type === 'system' && 
        (m.content === 'Connected to AI Terminal Agent' || 
         m.content === 'Ready for your commands!')
      ))
    : messages;

  const renderMessage = (message) => {
    const { type, content, id, authUrl } = message;
    
    if (containsJsonActionPattern(content)) {
      return null;
    }
    
    if (type === 'command') {
      return null;
    }
    
    // Hide welcome messages after user has interacted
    if (hasUserInteracted && 
        type === 'system' && 
        (content === 'Connected to AI Terminal Agent' || content === 'Ready for your commands!')) {
      return null;
    }
    
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
      case 'verbose':
        return (
          <div key={id} className="px-6 py-1 text-blue-300 text-sm opacity-70">
            {content}
          </div>
        );
      case 'action':
        return null;
      case 'system':
        return (
          <div key={id} className="px-4 py-2 text-purple-300 font-bold text-center my-2">
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
              <div>
                <CodeBlockFormatter content={content} />
              </div>
            </div>
          </div>
        );
      case 'calendar-auth':
        return (
          <div key={id} className="flex justify-center my-4">
            <button
              onClick={() => openAuthUrl(authUrl)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md shadow"
            >
              Open Authorization Page
            </button>
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
  
  const toggleThinking = () => {
    setShowThinking(prev => !prev);
  };

useEffect(() => {
  const textarea = document.querySelector('textarea');
  if (textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }
}, [input]);
  
  return (
    <div className="h-full flex flex-col">
      <style>{scrollbarStyles}</style>
      
      <div className="px-3 py-2 bg-black border-b border-gray-700 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : isConnecting ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="text-sm text-gray-300">
            {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
          </span>
        </div>
        
        <div className="flex items-center space-x-3">
          {thoughts.length > 0 && (
            <button 
              onClick={toggleThinking}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-md flex items-center text-xs sm:text-sm"
            >
              <span className="mr-1">{showThinking ? 'Hide' : 'Show'} Thinking</span>
            </button>
          )}
          
          {!isConnected && !isConnecting && (
            <button 
              onClick={handleReconnect}
              className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md flex items-center text-xs sm:text-sm"
            >
              <FiRefreshCw className="mr-1" /> Reconnect
            </button>
          )}
        </div>
      </div>
      
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden relative">
          <div 
            ref={terminalRef}
            className="flex-1 overflow-y-auto bg-black text-gray-200 font-mono text-sm px-3 sm:px-4 terminal-scroll absolute inset-0"
          >
            {error && (
              <div className="bg-red-900/30 text-red-300 p-4 m-2 rounded-md border-l-4 border-red-500">
                {error}
              </div>
            )}
            
            {filteredMessages.length === 0 && !error && (
              <div className="p-8 text-center text-gray-500 italic">
                <FiTerminal className="mx-auto text-4xl mb-2" />
                <p>Type a command or question to begin</p>
              </div>
            )}
            
            <div className="space-y-1 py-2 mb-4">
              {filteredMessages.map(renderMessage)}
            </div>
          </div>
          
          {/* Fade overlay for main terminal */}
          <div 
            className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none" 
            style={{
              background: 'linear-gradient(to bottom, rgba(17, 24, 39, 0), rgba(17, 24, 39, 1) 85%)'
            }}
          />
        </div>
        
        {thoughts.length > 0 && showThinking && (
          <div className={`border-l border-gray-700 bg-gray-900 overflow-hidden flex flex-col relative ${window.innerWidth < 768 ? 'w-full absolute inset-0 z-10' : 'w-64 md:w-80 lg:w-96'}`}>
            <TerminalHeader title="AI Thinking Terminal" />
            <div className="flex-1 relative">
              <div className="absolute inset-0 p-2 font-mono bg-gray-950 overflow-y-auto terminal-scroll">
                {window.innerWidth < 768 && (
                  <button 
                    onClick={toggleThinking} 
                    className="absolute top-2 right-2 text-gray-400 hover:text-white z-20"
                  >
                    ✕
                  </button>
                )}
                <div className="opacity-70 text-xs text-gray-500 mb-2">
                  # Terminal session started
                  <br />
                  # AI processing thoughts...
                </div>
                
                {thoughts.map((thought, index) => (
                  <ThoughtBubble 
                    key={`thought-${index}-${thought.timestamp}`}
                    content={thought.content}
                    type={thought.type}
                    onComplete={null}
                  />
                ))}
                
                {isThinking && <ThinkingIndicator isVisible={isThinking} />}
              </div>
              
              {/* Fade overlay for thinking panel */}
              <div 
                className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none" 
                style={{
                  background: 'linear-gradient(to bottom, rgba(3, 7, 18, 0), rgba(3, 7, 18, 1) 85%)'
                }}
              />
            </div>
          </div>
        )}
      </div>
      
      <div className="p-2 md:p-4 md:px-10 lg:px-20 border-t border-gray-700">
        <div className="rounded-2xl bg-[#121212] border border-gray-700/50 overflow-hidden shadow-lg">
          {calendarMode && (
            <div className="bg-purple-900/30 text-purple-300 text-xs px-4 py-1 border-b border-purple-800/50">
              Calendar Mode: Creating a new event. Type the details of your meeting or appointment.
            </div>
          )}
          <textarea
            className={`w-full bg-transparent border-0 text-gray-200 pt-3 px-4 focus:outline-none resize-none min-h-[20px] max-h-[200px] overflow-y-auto ${calendarMode ? 'border-l-2 border-purple-500' : ''}`}
            placeholder={calendarMode ? "Describe your event (e.g., 'Meeting with Alex tomorrow at 3pm')..." : "Type a command or question..."}
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (input.trim() && isConnected && !isProcessing) {
                  handleSend();
                }
              } else {
                handleKeyDown(e);
              }
            }}
            disabled={!isConnected || isProcessing}
          />
          <div className="flex items-center px-4 py-3">
            <button 
              onClick={toggleCalendarMode}
              className={`flex items-center justify-center cursor-pointer px-2 py-1.5 rounded-full border ${
                calendarMode 
                  ? 'border-purple-500 text-purple-500 bg-purple-500/10 hover:bg-purple-500/20' 
                  : 'border-white/70 text-white/70 hover:text-white hover:border-white'
              } mr-2`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm">Schedule</span>
            </button>
            <div className="flex-1"></div>
            <button className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-800 text-white/70 hover:text-white hover:bg-gray-700 mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
            <button
              onClick={handleSend}
              disabled={!input.trim() || !isConnected || isProcessing}
              className={`flex items-center justify-center w-8 h-8 rounded-full ${
                !input.trim() || !isConnected || isProcessing
                  ? "bg-gray-600 cursor-not-allowed"
                  : "bg-white hover:bg-white/90"
              }`}
            >
              {isProcessing ? (
                <div className="w-4 h-4 border-t-2 border-gray-800 rounded-full animate-spin"></div>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-black" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          </div>
        </div>
        {isProcessing && !isThinking && (
          <div className="mt-2 text-xs text-indigo-400 animate-pulse">
            {calendarMode ? 'Creating calendar event...' : 'AI is processing your request...'}
          </div>
        )}
      </div>
    </div>
  );
};

const Command = () => {
  const location = useLocation();
  // Set sidebar open only if we're on the dashboard path
  const [sidebarOpen, setSidebarOpen] = useState(location.pathname === '/analytics');
  
  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev);
  };

  return (
    <div className="h-screen flex flex-col bg-black">
      <Navbar toggleSidebar={toggleSidebar} />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar isOpen={sidebarOpen} />
        
        <div className="flex-1 overflow-hidden bg-gray-900">
          <AITerminal />
        </div>
      </div>
    </div>
  );
};

export default Command;
