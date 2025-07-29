import React, { useEffect, useRef, useState } from 'react';
import './ChatRoom.css';
import { FaPaperclip } from 'react-icons/fa';

const WS_URL = 'ws://localhost:8000/ws'; // Update for deployment
const API_URL = 'http://127.0.0.1:8000';

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "hi", label: "Hindi", flag: "🇮🇳" },
  { code: "ar", label: "Arabic", flag: "🇸🇦" },
  { code: "zh-cn", label: "Chinese (Simplified)", flag: "🇨🇳" },
  { code: "zh-tw", label: "Chinese (Traditional)", flag: "🇹🇼" },
  { code: "es", label: "Spanish", flag: "🇪🇸" },
  { code: "fr", label: "French", flag: "🇫🇷" },
  { code: "de", label: "German", flag: "🇩🇪" },
  { code: "ru", label: "Russian", flag: "🇷🇺" },
  { code: "ja", label: "Japanese", flag: "🇯🇵" },
  { code: "ko", label: "Korean", flag: "🇰🇷" },
  { code: "it", label: "Italian", flag: "🇮🇹" },
  { code: "pt", label: "Portuguese", flag: "🇵🇹" },
  { code: "bn", label: "Bengali", flag: "🇧🇩" },
  { code: "pa", label: "Punjabi", flag: "🇮🇳" },
  { code: "gu", label: "Gujarati", flag: "🇮🇳" },
  { code: "ta", label: "Tamil", flag: "🇮🇳" },
  { code: "te", label: "Telugu", flag: "🇮🇳" },
  { code: "mr", label: "Marathi", flag: "🇮🇳" },
  { code: "ur", label: "Urdu", flag: "🇵🇰" },
  { code: "tr", label: "Turkish", flag: "🇹🇷" },
  { code: "vi", label: "Vietnamese", flag: "🇻🇳" },
  { code: "fa", label: "Persian", flag: "🇮🇷" },
  { code: "id", label: "Indonesian", flag: "🇮🇩" },
  { code: "th", label: "Thai", flag: "🇹🇭" },
  { code: "pl", label: "Polish", flag: "🇵🇱" },
  { code: "ro", label: "Romanian", flag: "🇷🇴" },
  { code: "nl", label: "Dutch", flag: "🇳🇱" },
  { code: "sv", label: "Swedish", flag: "🇸🇪" },
  { code: "uk", label: "Ukrainian", flag: "🇺🇦" },
  { code: "he", label: "Hebrew", flag: "🇮🇱" },
  { code: "ms", label: "Malay", flag: "🇲🇾" },
  { code: "am", label: "Amharic", flag: "🇪🇹" },
  { code: "sw", label: "Swahili", flag: "🇰🇪" },
];


function getLangFlag(code) {
  const lang = LANGUAGES.find(l => l.code === code);
  return lang ? lang.flag : "🏳️";
}

function getInitials(name) {
  return name ? name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2) : "?";
}

const ChatRoom = ({ username, room, onLeave, preferred_language: initialLang, isDarkMode }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState(initialLang || "en");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [typing, setTyping] = useState(false);
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const audioChunksRef = useRef([]);
  const [recordError, setRecordError] = useState(null);

  // Fetch chat history only when room changes
  useEffect(() => {
    fetch(`${API_URL}/history/${room}`)
      .then(res => res.json())
      .then(data => setMessages(data))
      .catch(e => {
        setError("Failed to fetch chat history.");
        console.error("History fetch error:", e);
      });
  }, [room]);

  // WebSocket connection only when room or username changes
  useEffect(() => {
    setLoading(true);
    setError(null);
    const ws = new WebSocket(`${WS_URL}/${room}/${username}`);
    socketRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ preferred_language: preferredLanguage }));
      setLoading(false);
    };

    ws.onerror = (e) => {
      setError("Connection error. Please try again later.");
      setLoading(false);
      console.error("WebSocket error:", e);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.info) {
        setMessages(prev => [...prev, { system: true, content: data.info }]);
      } else {
        setMessages(prev => [...prev, data]);
      }
    };

    ws.onclose = (e) => {
      setLoading(false);
      if (!e.wasClean) {
        setError(`WebSocket closed unexpectedly. Code: ${e.code}, Reason: ${e.reason || 'No reason provided'}. This might be due to network issues or the server closing the connection.`);
        console.error("WebSocket closed unexpectedly:", e);
      } else {
        console.log("WebSocket closed cleanly:", e);
      }
    };

    return () => {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      // ws.close();
    };
  }, [room, username, preferredLanguage]);

  // When preferredLanguage changes, send update message over existing socket
  useEffect(() => {
    if (socketRef.current && socketRef.current.readyState === 1) {
      socketRef.current.send(JSON.stringify({ type: "update_language", preferred_language: preferredLanguage }));
    }
  }, [preferredLanguage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Typing indicator (local only)
  useEffect(() => {
    setTyping(input.length > 0);
  }, [input]);

  // --- Voice Recording Logic ---
  const handleMicClick = async () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorder) mediaRecorder.stop();
      setIsRecording(false);
      return;
    }
    setRecordError(null);
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      setRecordError('Audio recording not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new window.MediaRecorder(stream);
      setMediaRecorder(recorder);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const mimeType = audioChunksRef.current[0]?.type || 'audio/webm';
        const extension = mimeType.split('/')[1] || 'webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const filename = `input.${extension}`;
        // Send to backend
        const formData = new FormData();
        formData.append('audio', audioBlob, filename);
        formData.append('room', room);
        formData.append('username', username);
        formData.append('preferred_language', preferredLanguage);
        try {
          await fetch(`${API_URL}/voice_message`, {
            method: 'POST',
            body: formData,
          });
          // The backend should send the processed message to the WebSocket
        } catch (err) {
          setRecordError('Failed to send audio.');
          console.error('Failed to send audio:', err);
        }
        audioChunksRef.current = [];
      };
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      setRecordError('Microphone access denied or unavailable.');
      console.error('Microphone access denied or unavailable:', err);
    }
  };

  // Reset audio chunks when not recording
  useEffect(() => {
    if (!isRecording) audioChunksRef.current = [];
  }, [isRecording]);

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setPreferredLanguage(newLang);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('room', room);
    formData.append('username', username);
    try {
      const res = await fetch('http://127.0.0.1:8000/upload_file', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.file_id) {
        // Send a message with file info
        if (socketRef.current && socketRef.current.readyState === 1) {
          socketRef.current.send(JSON.stringify({
            type: 'file',
            file_id: data.file_id,
            filename: data.filename,
          }));
        }
      }
    } catch {
      setError('File upload failed.');
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (input.trim() && socketRef.current && socketRef.current.readyState === 1) {
      socketRef.current.send(JSON.stringify({ content: input }));
      setInput('');
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
  };

  if (loading) return <div className="chat-room-card"><div className="system-message"><span role="img" aria-label="loading">⏳</span> Connecting...</div></div>;
  if (error) return <div className="chat-room-card"><div className="system-message" style={{ color: 'var(--color-primary)' }}>{error}</div></div>;

  return (
    <div className={`chat-room-card${isDarkMode ? ' dark' : ''}`}> 
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <span className="room-badge">Room: {room}</span>
        </div>
        <div className="chat-header-right">
          <button className="leave-btn" onClick={onLeave}>Leave</button>
        </div>
      </div>
      {/* Controls */}
      <div className="chat-controls">
        <label className="lang-label">
          <span>Language:</span>
          <select className="lang-select" value={preferredLanguage} onChange={handleLanguageChange}>
            {LANGUAGES.map(lang => (
              <option key={lang.code} value={lang.code}>{lang.flag} {lang.label}</option>
            ))}
          </select>
        </label>
      </div>
      {/* Messages */}
      <div className="chat-messages-list">
        {messages.map((msg, idx) =>
          msg.system ? (
            <div key={idx} className="system-message">{msg.content}</div>
          ) : (
            <div
              key={idx}
              className={
                "chat-message-row " + (username === msg.username ? "own-message" : "other-message")
              }
              title={msg.original_content && msg.original_content !== msg.content ? `Original (${msg.original_language || "?"}): ${msg.original_content}` : undefined}
            >
              <div className="avatar">
                {getInitials(msg.username)}
              </div>
              <div className="chat-bubble">
                <div className="chat-bubble-header">
                  <span className="chat-username">{msg.username}</span>
                  {msg.detected_language && (
                    <span className="chat-lang-flag">{getLangFlag(msg.detected_language)}</span>
                  )}
                </div>
                <div className="chat-content">
                  {msg.type === 'file' && msg.file_id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{msg.filename}</span>
                      <a
                        href={`http://127.0.0.1:8000/download_file/${msg.file_id}`}
                        download={msg.filename}
                        style={{ color: '#2563eb', textDecoration: 'none', display: 'flex', alignItems: 'center' }}
                        title="Download file"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5V13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2.6a.5.5 0 0 1 1 0V13a3 3 0 0 1-3 3H3a3 3 0 0 1-3-3v-2.6a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/></svg>
                      </a>
                    </div>
                  ) : msg.audio_base64 ? (
                    <audio controls src={`data:audio/mp3;base64,${msg.audio_base64}`} />
                  ) : (
                    msg.content
                  )}
                </div>
                <div className="chat-timestamp" title={msg.timestamp ? new Date(msg.timestamp).toLocaleString() : undefined}>
                  {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : ""}
                </div>
              </div>
            </div>
          )
        )}
        <div ref={messagesEndRef} />
      </div>
      {/* Typing Indicator */}
      {typing && (
        <div className="typing-indicator">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      )}
      {/* Input */}
      <form className="chat-input-form" onSubmit={sendMessage}>
        <label htmlFor="file-upload" style={{ cursor: 'pointer', marginRight: 8 }} title="Send a file">
          <FaPaperclip style={{ fontSize: 22, color: '#2563eb' }} />
          <input
            id="file-upload"
            type="file"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </label>
        <button
          type="button"
          className={`mic-btn${isRecording ? ' recording' : ''}`}
          onClick={handleMicClick}
          title={isRecording ? 'Stop recording' : 'Record voice message'}
          style={{ marginRight: 8 }}
        >
          {isRecording ? '🔴' : '🎤'}
        </button>
        <input
          className="chat-input"
          value={input}
          onChange={handleInputChange}
          placeholder="Type a message..."
        />
        <button className="send-btn" type="submit">Send</button>
      </form>
      {recordError && <div className="system-message" style={{ color: 'red' }}>{recordError}</div>}
    </div>
  );
};

export default ChatRoom; 