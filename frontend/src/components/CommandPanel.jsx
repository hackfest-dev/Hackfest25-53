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

  // Load command history from localStorage on mount
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

  // Save history to localStorage when it changes
  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem('commandHistory', JSON.stringify(history));
    }
  }, [history]);

  // Execute a command directly
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
      
      // Update output and history
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
      ].slice(0, 10)); // Keep only the last 10 commands
      
      // Reset command input
      setCommand('');
      
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to execute command');
      setOutput(error.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  };

  // Generate and execute command from task description
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
      // First, generate the command
      const generateResponse = await api.post('/command/generate', { task });
      const generatedCommand = generateResponse.data.command;
      
      // Show the generated command
      setOutput(`Generated command: ${generatedCommand}\n\nExecuting...\n`);
      
      // Then execute it
      const executeResponse = await api.post('/command/execute', { 
        command: generatedCommand 
      });
      
      // Update output with results
      setOutput(prev => prev + '\n' + executeResponse.data.output);
      
      // Add to history
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
      
      // Reset task input
      setTask('');
      
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to generate or execute command');
      setOutput(prev => prev + '\n' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Rerun a command from history
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
    <div className="command-panel">
      <h1 className="page-title">Command Panel</h1>
      
      <div className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === 'execute' ? 'active' : ''}`}
          onClick={() => setActiveTab('execute')}
        >
          Execute Command
        </button>
        <button 
          className={`tab-button ${activeTab === 'generate' ? 'active' : ''}`}
          onClick={() => setActiveTab('generate')}
        >
          Generate Command
        </button>
      </div>
      
      <div className="tab-content">
        {activeTab === 'execute' ? (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Execute Command</h2>
            </div>
            <div className="card-content">
              <form onSubmit={handleExecuteCommand}>
                <div className="form-group">
                  <label htmlFor="command" className="form-label">Command</label>
                  <input
                    type="text"
                    id="command"
                    className="form-input"
                    placeholder="Enter system command..."
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    disabled={loading}
                  />
                </div>
                
                {error && <div className="error-message">{error}</div>}
                
                <button 
                  type="submit" 
                  className="button button-primary"
                  disabled={loading}
                >
                  {loading ? 'Executing...' : 'Execute Command'}
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Generate Command</h2>
            </div>
            <div className="card-content">
              <form onSubmit={handleGenerateCommand}>
                <div className="form-group">
                  <label htmlFor="task" className="form-label">Task Description</label>
                  <textarea
                    id="task"
                    className="form-textarea"
                    placeholder="Describe what you want to do..."
                    value={task}
                    onChange={(e) => setTask(e.target.value)}
                    disabled={loading}
                  />
                </div>
                
                {error && <div className="error-message">{error}</div>}
                
                <button 
                  type="submit" 
                  className="button button-primary"
                  disabled={loading}
                >
                  {loading ? 'Generating...' : 'Generate & Execute Command'}
                </button>
              </form>
            </div>
          </div>
        )}
        
        {output && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Output</h2>
            </div>
            <div className="card-content">
              <pre className="command-output">{output}</pre>
            </div>
          </div>
        )}
        
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Command History</h2>
          </div>
          <div className="card-content">
            {history.length === 0 ? (
              <p className="empty-list">No command history yet.</p>
            ) : (
              <div className="history-list">
                {history.map(item => (
                  <div key={item.id} className="history-item">
                    <div className="history-header">
                      <span className="history-type">{item.type === 'execute' ? 'Executed' : 'Generated'}</span>
                      <span className="history-time">
                        {new Date(item.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="history-command">
                      {item.type === 'execute' ? item.command : `Task: ${item.task}`}
                    </div>
                    <button 
                      className="button button-small"
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
