import { useState } from 'react'
import RoomJoinForm from './components/RoomJoinForm'
import ChatRoom from './components/ChatRoom'
import './App.css'

function App() {
  const [user, setUser] = useState(null)

  const handleJoin = async ({ username, room, preferred_language }) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/create-room/${room}`, { method: 'POST' });
      const data = await res.json();
      console.log('[CREATE ROOM]', data);
    } catch (e) {
      console.error('Failed to create/reset room:', e);
    }
    setUser({ username, room, preferred_language });
  }

  const handleLeave = () => {
    setUser(null)
  }

  return (
    <div className="app-container">
      {!user ? (
        <RoomJoinForm onJoin={handleJoin} />
      ) : (
        <ChatRoom username={user.username} room={user.room} onLeave={handleLeave} preferred_language={user.preferred_language} />
      )}
    </div>
  )
}

export default App
