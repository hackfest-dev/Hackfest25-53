import React, { useState, useEffect, useRef } from 'react';
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
  
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

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

  const startRecording = async () => {
    try {
      setError(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.addEventListener('dataavailable', event => {
        audioChunksRef.current.push(event.data);
      });
      
      mediaRecorder.addEventListener('stop', handleAudioStop);
      
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      setError('Microphone access denied or not available');
      console.error('Error accessing microphone:', error);
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };
  
  const handleAudioStop = async () => {
    try {
      setIsTranscribing(true);
      
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      console.log(`Audio recorded: ${audioBlob.size} bytes`);
      
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        try {
          const base64Audio = reader.result.split(',')[1];
          console.log(`Base64 audio data length: ${base64Audio.length} characters`);
          
          // Simple validation
          if (!base64Audio || base64Audio.length < 100) {
            throw new Error('Audio recording too short or empty');
          }
          
          console.log('Calling transcription API...');
          
          const response = await api.post('/ai/transcribe', { audio: base64Audio });
          
          console.log('Transcription API response:', response.data);
          
          if (response.data.success) {
            if (activeTab === 'execute') {
              setCommand(response.data.text);
            } else {
              setTask(response.data.text);
            }
          } else {
            // Show more helpful error if it's a Whisper installation issue
            if (response.data.error && response.data.error.includes('Whisper AI is not installed')) {
              setError(
                'Whisper AI is not installed on the server. Please check the installation guide in the docs folder.'
              );
            } else {
              setError('Failed to transcribe audio: ' + response.data.error);
            }
          }
        } catch (error) {
          console.error('Transcription API error details:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            endpoint: '/ai/transcribe',
            message: error.message
          });
          
          // Handle Whisper installation errors specifically
          if (error.response?.data?.error?.includes('Whisper AI is not installed')) {
            setError(
              'Speech recognition requires Whisper AI to be installed on the server. Please check the installation guide in the docs folder.'
            );
          } else {
            setError('Error transcribing audio: ' + (error.response?.data?.error || error.message));
          }
        } finally {
          setIsTranscribing(false);
        }
      };
    } catch (error) {
      console.error('Audio processing error:', error);
      setError('Error processing audio: ' + error.message);
      setIsTranscribing(false);
    }
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
                  <div className="flex">
                    <input
                      type="text"
                      id="command"
                      className="flex-grow bg-gray-700 border border-gray-600 rounded-l-md py-2 px-4 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Enter system command..."
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      disabled={loading || isRecording || isTranscribing}
                    />
                    <button
                      type="button"
                      className={`px-4 py-2 rounded-r-md ${isRecording 
                        ? 'bg-red-600 text-white animate-pulse' 
                        : isTranscribing 
                          ? 'bg-yellow-600 text-white'
                          : 'bg-gray-600 text-gray-200 hover:bg-gray-500'}`}
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={loading || isTranscribing}
                      title={isRecording ? "Stop recording" : isTranscribing ? "Transcribing..." : "Record voice command"}
                    >
                      {isRecording ? (
                        <span className="flex items-center">
                          <span className="w-2 h-2 bg-red-300 rounded-full mr-2"></span>
                          Stop
                        </span>
                      ) : isTranscribing ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </span>
                      ) : (
                        <span className="flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          </svg>
                          Mic
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {error && <div className="mb-4 text-red-400 bg-red-900/30 p-3 rounded-md">{error}</div>}

                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-md shadow transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading || isRecording || isTranscribing}
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
                  <div className="flex">
                    <textarea
                      id="task"
                      className="flex-grow bg-gray-700 border border-gray-600 rounded-l-md py-2 px-4 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-[120px]"
                      placeholder="Describe what you want to do..."
                      value={task}
                      onChange={(e) => setTask(e.target.value)}
                      disabled={loading || isRecording || isTranscribing}
                    />
                    <button
                      type="button"
                      className={`px-4 self-stretch rounded-r-md ${isRecording 
                        ? 'bg-red-600 text-white animate-pulse' 
                        : isTranscribing 
                          ? 'bg-yellow-600 text-white'
                          : 'bg-gray-600 text-gray-200 hover:bg-gray-500'}`}
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={loading || isTranscribing}
                      title={isRecording ? "Stop recording" : isTranscribing ? "Transcribing..." : "Record voice command"}
                    >
                      {isRecording ? (
                        <span className="flex items-center">
                          <span className="w-2 h-2 bg-red-300 rounded-full mr-2"></span>
                          Stop
                        </span>
                      ) : isTranscribing ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </span>
                      ) : (
                        <span className="flex flex-col items-center justify-center h-full">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          </svg>
                          Mic
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {error && <div className="mb-4 text-red-400 bg-red-900/30 p-3 rounded-md">{error}</div>}

                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-md shadow transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading || isRecording || isTranscribing}
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
