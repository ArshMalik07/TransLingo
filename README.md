# TransLingo: Real-Time Multilingual Voice & Text Chat Application

## Overview
TransLingo is a full-stack, AI-powered real-time chat application that breaks language barriers by enabling seamless communication across different languages through both text and voice.

Leveraging advanced AI-driven speech recognition, natural language translation, and text-to-speech synthesis, TransLingo allows users to chat effortlessly in their native languages — while still being understood globally.

Built with a modern React frontend and a fast, scalable FastAPI backend, the app supports:

Real-time multilingual voice-to-voice and text-to-text conversations

AI-based live language translation

Smart file sharing within chat rooms

Persistent chat history with contextual understanding

A sleek, responsive UI with Dark Mode for better accessibility and UX

Whether it's global teams, remote collaboration, or personal conversations — TransLingo is your AI-powered gateway to borderless communication.

---

## Features
- **Real-Time Chat:** Join rooms and chat instantly with others.
- **Voice-to-Voice Translation:** Speak in one language, get translated speech/text in another.
- **Text Translation:** Messages are auto-translated to each user's preferred language.
- **File Sharing:** Upload and download files in chat rooms.
- **Persistent History:** Chat history is stored and loaded per room.
- **Dark Mode:** Toggle between light and dark themes.
- **Multi-language Support:** Choose from a wide range of languages.

---

## Technology Stack
### Frontend
- **React 19** (with hooks)
- **Vite** (for fast development)
- **Socket.IO Client** (real-time communication)
- **React Icons** (UI icons)
- **CSS** (custom, responsive, dark mode)

### Backend
- **FastAPI** (Python web framework)
- **Uvicorn** (ASGI server)
- **SQLAlchemy** (ORM, SQLite database)
- **Pydantic** (data validation)
- **googletrans** (translation)
- **Whisper** (OpenAI speech-to-text)
- **gTTS** (Google Text-to-Speech)

---

## Folder Structure
```
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app, WebSocket, REST endpoints
│   │   ├── voice_translator.py # Speech-to-text, translation, TTS
│   │   ├── models.py         # SQLAlchemy models
│   │   ├── schemas.py        # Pydantic schemas
│   │   ├── db.py             # Database connection/init
│   │   └── utils.py          # (Placeholder for utilities)
│   ├── static/uploads/       # Uploaded files
│   ├── chat.db               # SQLite database
│   └── requirements.txt      # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Main React app
│   │   ├── components/
│   │   │   ├── ChatRoom.jsx      # Chat UI
│   │   │   ├── VoiceTranslator.jsx # Voice translation UI
│   │   │   └── RoomJoinForm.jsx   # Room/user setup
│   │   └── ...
│   ├── public/               # Static assets
│   ├── index.html            # App entry
│   └── package.json          # Frontend dependencies/scripts
├── README.md                 # (This file)
└── package.json              # (Root, for shared deps like react-icons)
```

---

## Setup Instructions

### 1. Backend (FastAPI)
#### Prerequisites
- Python 3.8+
- (Recommended) Create a virtual environment:
  ```bash
  python -m venv venv
  source venv/bin/activate  # On Windows: venv\Scripts\activate
  ```
- Install dependencies:
  ```bash
  pip install -r backend/requirements.txt
  pip install sounddevice scipy whisper gtts
  ```
- (Optional) Install ffmpeg for Whisper (if not already):
  - [FFmpeg Download](https://ffmpeg.org/download.html)

#### Run the Backend
```bash
cd backend/app
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Frontend (React)
#### Prerequisites
- Node.js 18+
- npm

#### Run the Frontend
```bash
cd frontend
npm install
npm run dev
```

The app will be available at [http://localhost:5173](http://localhost:5173) (default Vite port).

---

## Usage Guide
1. **Start both backend and frontend servers.**
2. **Open the frontend in your browser.**
3. **Join a room:** Enter a username, room name, and preferred language.
4. **Chat:** Send text or voice messages. Messages are translated to each user's preferred language.
5. **Voice Translation:** Use the Voice Translator to record and send translated speech.
6. **File Sharing:** Upload/download files in chat rooms.
7. **Dark Mode:** Toggle dark mode from the UI.

---

## API Endpoints (Backend)
- `GET /history/{room}`: Get chat history for a room.
- `POST /create-room/{room}`: Create/reset a chat room.
- `POST /voice-translate`: Upload audio, get translated text and TTS audio.
- `POST /voice_message`: Send a voice message to a room.
- `POST /upload_file`: Upload a file to a room.
- `GET /download_file/{file_id}`: Download a file by ID.
- `GET /supported_languages`: List supported languages.
- `WebSocket /ws/{room}/{username}`: Real-time chat and translation.

---

## Contributing
Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.
