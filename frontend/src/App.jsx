import { useState, useEffect, useRef } from 'react'
import RoomJoinForm from './components/RoomJoinForm'
import ChatRoom from './components/ChatRoom'
import VoiceTranslator from './components/VoiceTranslator'
import './App.css'
import { FaMoon, FaSun, FaComments } from 'react-icons/fa';

const WS_URL = 'ws://localhost:8000/ws';

function App() {
  const [user, setUser] = useState(null)
  const [showVoiceTranslator, setShowVoiceTranslator] = useState(false)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const socketRef = useRef(null)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const stored = localStorage.getItem('chat_dark_mode');
    return stored ? stored === 'true' : false;
  });

  useEffect(() => {
    localStorage.setItem('chat_dark_mode', isDarkMode);
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
      document.documentElement.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
      document.documentElement.classList.remove('dark-mode');
    }
  }, [isDarkMode]);

  const handleJoin = async ({ username, room, preferred_language }) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/create-room/${room}`, { method: 'POST' });
      const data = await res.json();
      console.log('[CREATE ROOM]', data);
    } catch (e) {
      console.error('Failed to create/reset room:', e);
    }
    setUser({ username, room, preferred_language });
    setShowVoiceTranslator(false);
  }

  const handleLeave = () => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setUser(null);
    setMessages([]);
  }

  useEffect(() => {
    if (user) {
      setLoading(true);
      setError(null);
      const ws = new WebSocket(`${WS_URL}/${user.room}/${user.username}`);
      socketRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ preferred_language: user.preferred_language }));
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
          setError(`WebSocket closed unexpectedly. Code: ${e.code}, Reason: ${e.reason || 'No reason provided'}.`);
          console.error("WebSocket closed unexpectedly:", e);
        } else {
          console.log("WebSocket closed cleanly:", e);
        }
      };

      return () => {
        ws.close();
      };
    }
  }, [user]);

  const sendMessage = (message) => {
    if (socketRef.current && socketRef.current.readyState === 1) {
      socketRef.current.send(JSON.stringify(message));
    }
  };

  return (
    <>
      <header style={{
        width: '100%',
        maxWidth: 600,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px 0 0 0',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FaComments style={{ fontSize: 28, color: isDarkMode ? '#60a5fa' : '#2563eb' }} />
          <span style={{ fontWeight: 700, fontSize: '1.5em', letterSpacing: 1 }}>TransLingo - AI Chat App</span>
        </div>
        <button
          className="theme-toggle-btn"
          style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: isDarkMode ? '#60a5fa' : '#2563eb', marginRight: 8 }}
          onClick={() => setIsDarkMode(d => !d)}
          title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDarkMode ? <FaMoon /> : <FaSun />}
        </button>
      </header>
      <div className="app-container">
        {!user ? (
          <RoomJoinForm onJoin={handleJoin} />
        ) : (
          <>
            {!showVoiceTranslator ? (
              <ChatRoom
                username={user.username}
                room={user.room}
                onLeave={handleLeave}
                preferred_language={user.preferred_language}
                messages={messages}
                sendMessage={sendMessage}
                loading={loading}
                error={error}
                isDarkMode={isDarkMode}
              />
            ) : (
              <VoiceTranslator onSendMessage={sendMessage} isDarkMode={isDarkMode} />
            )}
          </>
        )}
      </div>
    </>
  )
}

export default App
