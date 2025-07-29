import React, { useEffect, useRef, useState } from 'react';
import './ChatRoom.css';

const WS_URL = 'ws://localhost:8000/ws'; // Update for deployment
const API_URL = 'http://127.0.0.1:8000';

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "hi", label: "Hindi", flag: "🇮🇳" },
  { code: "ar", label: "Arabic", flag: "🇸🇦" },
  { code: "zh-cn", label: "Chinese (Simplified)", flag: "🇨🇳" },
  { code: "es", label: "Spanish", flag: "🇪🇸" },
  { code: "fr", label: "French", flag: "🇫🇷" },
  { code: "de", label: "German", flag: "🇩🇪" },
  { code: "ru", label: "Russian", flag: "🇷🇺" },
  { code: "ja", label: "Japanese", flag: "🇯🇵" },
  { code: "ko", label: "Korean", flag: "🇰🇷" },
  // Add more as needed
];

function getLangFlag(code) {
  const lang = LANGUAGES.find(l => l.code === code);
  return lang ? lang.flag : "🏳️";
}

function getInitials(name) {
  return name ? name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2) : "?";
}

const ChatRoom = ({ username, room, onLeave, preferred_language: initialLang }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState(initialLang || "en");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [typing, setTyping] = useState(false);
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const stored = localStorage.getItem('chat_dark_mode');
    return stored ? stored === 'true' : false;
  });

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
      ws.close();
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

  useEffect(() => {
    localStorage.setItem('chat_dark_mode', isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
  }, [isDarkMode]);

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setPreferredLanguage(newLang);
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
          <button className="theme-toggle-btn" onClick={() => setIsDarkMode(d => !d)} title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
            {isDarkMode ? '🌙' : '☀️'}
          </button>
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
                <div className="chat-content">{msg.content}</div>
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
        <input
          className="chat-input"
          value={input}
          onChange={handleInputChange}
          placeholder="Type a message..."
        />
        <button className="send-btn" type="submit">Send</button>
      </form>
    </div>
  );
};

export default ChatRoom; 