import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { saveCommandToFirestore, getCommandHistory } from '../services/firebase';

function CommandPanel({ user }) {
  const [command, setCommand] = useState('');
  const [task, setTask] = useState('');
  const [output, setOutput] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('execute');
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoadingHistory(true);
        const commandHistory = await getCommandHistory(20);
        setHistory(commandHistory);
      } catch (error) {
        console.error('Error fetching command history:', error);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [user]);

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

      const commandData = {
        type: 'execute',
        command,
        output: response.data.output,
        timestamp: new Date(),
      };

      await saveCommandToFirestore(commandData);

      setHistory((prev) => [
        {
          ...commandData,
          id: Date.now(),
        },
        ...prev,
      ]);

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
      const isCalendarRequest = /calendar|schedule|event|meeting|appointment|remind/i.test(task);
      const isYouTubeRequest = /youtube|play|watch|video|song/i.test(task);

      if (isCalendarRequest) {
        setOutput(`Detected calendar request. Processing: "${task}"...\n\nAdding to calendar...`);

        try {
          const calendarResponse = await api.post('/calendar/events/natural', { text: task });

          if (calendarResponse.data.success) {
            const eventDetails = calendarResponse.data.event;
            setOutput(
              (prev) =>
                prev +
                `\n\n✅ Event added: ${eventDetails.summary}\nStart: ${new Date(
                  eventDetails.start.dateTime
                ).toLocaleString()}\nEnd: ${new Date(eventDetails.end.dateTime).toLocaleString()}`
            );

            if (calendarResponse.data.calendarLink) {
              setOutput((prev) => prev + `\n\nView in Google Calendar: ${calendarResponse.data.calendarLink}`);
            }

            const commandData = {
              type: 'calendar',
              task,
              command: `Adding event: ${eventDetails.summary}`,
              output: `Event added: ${eventDetails.summary}`,
              eventDetails: eventDetails,
              calendarLink: calendarResponse.data.calendarLink,
              timestamp: new Date(),
            };

            await saveCommandToFirestore(commandData);

            setHistory((prev) => [
              {
                ...commandData,
                id: Date.now(),
              },
              ...prev,
            ]);
          }
        } catch (error) {
          throw error;
        }
      } else if (isYouTubeRequest) {
        setOutput(`Detected YouTube request. Processing: "${task}"...\n\nSearching and playing video...`);

        const youtubeResponse = await api.post('/command/youtube', { query: task });

        if (youtubeResponse.data.success) {
          const videoInfo = youtubeResponse.data.videoInfo;
          setOutput(
            (prev) =>
              prev +
              `\n\n✅ Now playing: ${videoInfo.title}\nChannel: ${videoInfo.channelTitle}\nURL: ${youtubeResponse.data.videoUrl}`
          );

          const commandData = {
            type: 'youtube',
            task,
            command: `Playing YouTube video: ${videoInfo.title}`,
            output: `Video played: ${videoInfo.title} (${videoInfo.channelTitle})`,
            videoInfo: videoInfo,
            videoUrl: youtubeResponse.data.videoUrl,
            timestamp: new Date(),
          };

          await saveCommandToFirestore(commandData);

          setHistory((prev) => [
            {
              ...commandData,
              id: Date.now(),
            },
            ...prev,
          ]);
        } else {
          throw new Error(youtubeResponse.data.error || 'Failed to play video');
        }
      } else {
        const generateResponse = await api.post('/command/generate', { task });
        const generatedCommand = generateResponse.data.command;

        setOutput(`Generated command: ${generatedCommand}\n\nExecuting...\n`);

        const executeResponse = await api.post('/command/execute', {
          command: generatedCommand,
        });

        setOutput((prev) => prev + '\n' + executeResponse.data.output);

        const commandData = {
          type: 'generate',
          task,
          command: generatedCommand,
          output: executeResponse.data.output,
          timestamp: new Date(),
        };

        await saveCommandToFirestore(commandData);

        setHistory((prev) => [
          {
            ...commandData,
            id: Date.now(),
          },
          ...prev,
        ]);
      }

      setTask('');
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to generate or execute command');
      setOutput((prev) => prev + '\n' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get('code');

    if (authCode) {
      window.history.replaceState({}, document.title, window.location.pathname);

      setOutput('Processing Google Calendar authorization...');
      setLoading(true);

      api
        .post('/calendar/oauth2callback', { code: authCode })
        .then((response) => {
          if (response.data.success) {
            setOutput('✅ Successfully authorized with Google Calendar! You can now create calendar events.');
          } else {
            setOutput('❌ Authorization failed: ' + response.data.error);
          }
        })
        .catch((error) => {
          setOutput('❌ Authorization error: ' + (error.response?.data?.error || error.message));
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, []);

  const handleRerunCommand = async (item) => {
    if (item.type === 'execute') {
      setCommand(item.command);
      setActiveTab('execute');
    } else if (item.type === 'youtube') {
      setTask(item.task);
      setActiveTab('generate');
    } else if (item.type === 'calendar') {
      setTask(item.task);
      setActiveTab('generate');
    } else {
      setTask(item.task);
      setActiveTab('generate');
    }
  };

  const handleOpenAuthUrl = (url) => {
    window.open(url, '_blank');
  };

  return (
    <div className="bg-gray-900 text-gray-100 min-h-screen p-6">
      <h1 className="text-3xl font-bold text-indigo-400 mb-6">Command Panel</h1>

      <div className="flex mb-6 border-b border-gray-700">
        <button
          className={`px-4 py-2 mr-2 focus:outline-none transition-colors duration-200 ${
            activeTab === 'execute' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400 hover:text-gray-200'
          }`}
          onClick={() => setActiveTab('execute')}
        >
          Execute Command
        </button>
        <button
          className={`px-4 py-2 focus:outline-none transition-colors duration-200 ${
            activeTab === 'generate' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400 hover:text-gray-200'
          }`}
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
                  <label htmlFor="command" className="block text-sm font-medium text-gray-300 mb-2">
                    Command
                  </label>
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
                  <label htmlFor="task" className="block text-sm font-medium text-gray-300 mb-2">
                    Task Description
                  </label>
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
            {loadingHistory ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-8 h-8 border-t-2 border-b-2 border-indigo-500 rounded-full animate-spin"></div>
              </div>
            ) : history.length === 0 ? (
              <p className="text-gray-400 italic">No command history yet.</p>
            ) : (
              <div className="space-y-4">
                {history.map((item) => (
                  <div key={item.id} className="bg-gray-700 rounded-lg p-4 hover:bg-gray-650 transition-colors duration-200">
                    <div className="flex justify-between items-center mb-2">
                      <span
                        className={`text-xs px-2 py-1 ${
                          item.type === 'youtube'
                            ? 'bg-red-500/20 text-red-300'
                            : item.type === 'calendar'
                            ? 'bg-green-500/20 text-green-300'
                            : item.type === 'auth'
                            ? 'bg-yellow-500/20 text-yellow-300'
                            : 'bg-indigo-500/20 text-indigo-300'
                        } rounded-full`}
                      >
                        {item.type === 'execute'
                          ? 'Executed'
                          : item.type === 'youtube'
                          ? 'YouTube'
                          : item.type === 'calendar'
                          ? 'Calendar'
                          : item.type === 'auth'
                          ? 'Auth'
                          : 'Generated'}
                      </span>
                      <span className="text-gray-400 text-xs">
                        {new Date(item.timestamp.seconds ? item.timestamp.toDate() : item.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-gray-200 mb-3 break-all">
                      {item.type === 'execute'
                        ? item.command
                        : item.type === 'youtube'
                        ? `Video: ${item.videoInfo?.title || 'YouTube video'}`
                        : item.type === 'calendar'
                        ? `Event: ${item.eventDetails?.summary || 'Calendar event'}`
                        : item.type === 'auth'
                        ? 'Google Calendar Authorization'
                        : `Task: ${item.task}`}
                    </div>
                    {item.type === 'youtube' && item.videoUrl && (
                      <div className="mb-3">
                        <a
                          href={item.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Open video again
                        </a>
                      </div>
                    )}
                    {item.type === 'calendar' && item.calendarLink && (
                      <div className="mb-3">
                        <a
                          href={item.calendarLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-400 hover:text-green-300 text-sm"
                        >
                          View in Google Calendar
                        </a>
                      </div>
                    )}
                    {item.type === 'auth' && item.authUrl && (
                      <div className="mb-3">
                        <button
                          onClick={() => handleOpenAuthUrl(item.authUrl)}
                          className="text-yellow-400 hover:text-yellow-300 text-sm font-medium bg-yellow-900/30 px-3 py-2 rounded inline-block"
                        >
                          Open Authorization Page
                        </button>
                      </div>
                    )}
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
