import React, { useState, useEffect } from 'react';
import api from '../services/api';

function CommandPanel() {
  const [command, setCommand] = useState('');
  const [task, setTask] = useState('');
  const [output, setOutput] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('execute');

  useEffect(() => {
    const savedHistory = localStorage.getItem('commandHistory');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Error parsing command history:', e);
      }
    }
  }, []);

  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem('commandHistory', JSON.stringify(history));
    }
  }, [history]);

  const handleExecuteCommand = async (e) => {
    e.preventDefault();
    
    if (!command.trim()) {
      setError('Please enter a command to execute');
      return;
    }
    
    setLoading(true);
    setError(null);
    setOutput('');
    
    try {
      const response = await api.post('/command/execute', { command });
      
      setOutput(response.data.output);
      setHistory(prev => [
        { 
          id: Date.now(), 
          type: 'execute', 
          command, 
          output: response.data.output,
          timestamp: new Date() 
        }, 
        ...prev
      ].slice(0, 10));
      
      setCommand('');
      
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to execute command');
      setOutput(error.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCommand = async (e) => {
    e.preventDefault();
    
    if (!task.trim()) {
      setError('Please enter a task description');
      return;
    }
    
    setLoading(true);
    setError(null);
    setOutput('');
    
    try {
      const generateResponse = await api.post('/command/generate', { task });
      const generatedCommand = generateResponse.data.command;
      
      setOutput(`Generated command: ${generatedCommand}\n\nExecuting...\n`);
      
      const executeResponse = await api.post('/command/execute', { 
        command: generatedCommand 
      });
      
      setOutput(prev => prev + '\n' + executeResponse.data.output);
      
      setHistory(prev => [
        { 
          id: Date.now(), 
          type: 'generate', 
          task, 
          command: generatedCommand,
          output: executeResponse.data.output,
          timestamp: new Date() 
        }, 
        ...prev
      ].slice(0, 10));
      
      setTask('');
      
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to generate or execute command');
      setOutput(prev => prev + '\n' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleRerunCommand = async (item) => {
    if (item.type === 'execute') {
      setCommand(item.command);
      setActiveTab('execute');
    } else {
      setTask(item.task);
      setActiveTab('generate');
    }
  };

  return (
    <div className="bg-gray-900 text-gray-100 min-h-screen p-6">
      <h1 className="text-3xl font-bold text-indigo-400 mb-6">Command Panel</h1>
      
      <div className="flex mb-6 border-b border-gray-700">
        <button 
          className={`px-4 py-2 mr-2 focus:outline-none transition-colors duration-200 ${activeTab === 'execute' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400 hover:text-gray-200'}`}
          onClick={() => setActiveTab('execute')}
        >
          Execute Command
        </button>
        <button 
          className={`px-4 py-2 focus:outline-none transition-colors duration-200 ${activeTab === 'generate' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400 hover:text-gray-200'}`}
          onClick={() => setActiveTab('generate')}
        >
          Generate Command
        </button>
      </div>
      
      <div className="space-y-6">
        {activeTab === 'execute' ? (
          <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
            <div className="bg-gray-700 px-6 py-4 border-b border-gray-600">
              <h2 className="text-xl font-semibold text-indigo-300">Execute Command</h2>
            </div>
            <div className="p-6">
              <form onSubmit={handleExecuteCommand}>
                <div className="mb-4">
                  <label htmlFor="command" className="block text-sm font-medium text-gray-300 mb-2">Command</label>
                  <input
                    type="text"
                    id="command"
                    className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-4 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Enter system command..."
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    disabled={loading}
                  />
                </div>
                
                {error && <div className="mb-4 text-red-400 bg-red-900/30 p-3 rounded-md">{error}</div>}
                
                <button 
                  type="submit" 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-md shadow transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading}
                >
                  {loading ? 'Executing...' : 'Execute Command'}
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
            <div className="bg-gray-700 px-6 py-4 border-b border-gray-600">
              <h2 className="text-xl font-semibold text-indigo-300">Generate Command</h2>
            </div>
            <div className="p-6">
              <form onSubmit={handleGenerateCommand}>
                <div className="mb-4">
                  <label htmlFor="task" className="block text-sm font-medium text-gray-300 mb-2">Task Description</label>
                  <textarea
                    id="task"
                    className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-4 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-[120px]"
                    placeholder="Describe what you want to do..."
                    value={task}
                    onChange={(e) => setTask(e.target.value)}
                    disabled={loading}
                  />
                </div>
                
                {error && <div className="mb-4 text-red-400 bg-red-900/30 p-3 rounded-md">{error}</div>}
                
                <button 
                  type="submit" 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-md shadow transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading}
                >
                  {loading ? 'Generating...' : 'Generate & Execute Command'}
                </button>
              </form>
            </div>
          </div>
        )}
        
        {output && (
          <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
            <div className="bg-gray-700 px-6 py-4 border-b border-gray-600">
              <h2 className="text-xl font-semibold text-indigo-300">Output</h2>
            </div>
            <div className="p-6">
              <pre className="bg-gray-900 p-4 rounded-md overflow-x-auto text-gray-300 whitespace-pre-wrap">{output}</pre>
            </div>
          </div>
        )}
        
        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gray-700 px-6 py-4 border-b border-gray-600">
            <h2 className="text-xl font-semibold text-indigo-300">Command History</h2>
          </div>
          <div className="p-6">
            {history.length === 0 ? (
              <p className="text-gray-400 italic">No command history yet.</p>
            ) : (
              <div className="space-y-4">
                {history.map(item => (
                  <div key={item.id} className="bg-gray-700 rounded-lg p-4 hover:bg-gray-650 transition-colors duration-200">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded-full">{item.type === 'execute' ? 'Executed' : 'Generated'}</span>
                      <span className="text-gray-400 text-xs">
                        {new Date(item.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-gray-200 mb-3 break-all">
                      {item.type === 'execute' ? item.command : `Task: ${item.task}`}
                    </div>
                    <button 
                      className="text-xs bg-gray-600 hover:bg-gray-500 text-gray-200 px-3 py-1 rounded-md transition-colors duration-200"
                      onClick={() => handleRerunCommand(item)}
                    >
                      Rerun
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CommandPanel;
