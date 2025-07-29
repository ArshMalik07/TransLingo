import React, { useState } from 'react';
import { FaGlobe } from 'react-icons/fa';

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "ar", label: "Arabic" },
  { code: "zh-cn", label: "Chinese (Simplified)" },
  // Add more as needed
];

const RoomJoinForm = ({ onJoin }) => {
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState('');
  const [language, setLanguage] = useState('en');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username && room) {
      onJoin({ username, room, preferred_language: language });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="room-join-form">
      <h2>Join a Chat Room</h2>
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={e => setUsername(e.target.value)}
        required
      />
      <input
        type="text"
        placeholder="Room Name"
        value={room}
        onChange={e => setRoom(e.target.value)}
        required
      />
      <label className="lang-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <FaGlobe style={{ fontSize: 18, color: '#2563eb' }} />
        <span>Language:</span>
        <select
          className="lang-select"
          value={language}
          onChange={e => setLanguage(e.target.value)}
          required
        >
          {LANGUAGES.map(lang => (
            <option key={lang.code} value={lang.code}>{lang.label}</option>
          ))}
        </select>
      </label>
      <button type="submit">Join</button>
    </form>
  );
};

export default RoomJoinForm; 