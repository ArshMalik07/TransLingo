from fastapi import (
    FastAPI, WebSocket, WebSocketDisconnect,
    Depends, UploadFile, File, Form, status, HTTPException
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from db import get_db, init_db
from models import Message
from schemas import MessageCreate

import asyncio
import json
import base64
import os
import uuid
from typing import Dict, List
from datetime import datetime
from googletrans import Translator, LANGUAGES
import uuid
import os
import base64
from voice_translator import speech_to_text, translate_text, speak_text
from fastapi import WebSocket
from fastapi.staticfiles import StaticFiles
import shutil


app = FastAPI()

# Ensure uploads directory exists
import os
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), '..', 'static', 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Serve static files
app.mount('/static', StaticFiles(directory=os.path.join(os.path.dirname(__file__), '..', 'static')), name='static')

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.user_info: Dict[WebSocket, Dict] = {}

    async def connect(self, room: str, websocket: WebSocket):
        await websocket.accept()
        if room not in self.active_connections:
            self.active_connections[room] = []
        self.active_connections[room].append(websocket)

    def disconnect(self, room: str, websocket: WebSocket):
        self.active_connections[room].remove(websocket)
        if not self.active_connections[room]:
            del self.active_connections[room]
        if websocket in self.user_info:
            del self.user_info[websocket]

    async def broadcast(self, room: str, message: dict, sender_ws: WebSocket = None):
        if room in self.active_connections:
            for connection in self.active_connections[room]:
                user_info = self.user_info.get(connection, {})
                preferred_language = user_info.get("preferred_language", "en")

                if message.get("type") == "file":
                    # For file messages, just send as is
                    try:
                        await connection.send_json(message)
                        print(f"📢 Sent file to {user_info.get('username')}: {message.get('file_name')}")
                    except Exception as e:
                        print(f"❌ Error sending file to user: {e}")
                else:
                    # For text messages, handle translation
                    translated_content = message["content"]
                    if preferred_language != message.get("detected_language", "en"):
                        translated_content = await async_translate_text(
                            message["content"], preferred_language
                        )

                    msg_to_send = message.copy()
                    msg_to_send["content"] = translated_content

                    try:
                        await connection.send_json(msg_to_send)
                        print(f"📢 Sent to {user_info.get('username')}: {translated_content}")
                    except Exception as e:
                        print(f"❌ Error sending to user: {e}")

manager = ConnectionManager()
translator = Translator()

# --- Utility Functions ---
async def async_translate_text(text, dest_lang):
    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(
            None, lambda: translator.translate(text, dest=dest_lang)
        )
        return result.text
    except Exception as e:
        print(f"⚠️ Translation failed: {e}")
        return text

async def detect_language(text):
    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(None, lambda: translator.detect(text))
        return result.lang
    except Exception as e:
        print(f"⚠️ Language detection failed: {e}")
        return "en"

# --- Startup Hook ---
@app.on_event("startup")
def on_startup():
    init_db()
    print("[STARTED] Server is up and database initialized.")

# --- WebSocket Endpoint ---
@app.websocket("/ws/{room}/{username}")
async def websocket_endpoint(websocket: WebSocket, room: str, username: str, db=Depends(get_db)):
    await manager.connect(room, websocket)
    print(f"🧠 {username} joined room {room}")

    try:
        try:
            init_data = await websocket.receive_json()
            print("🌐 Received init data:", init_data)
        except Exception as e:
            print("❌ Failed to receive JSON:", e)
            await websocket.send_json({"error": "Invalid initialization data"})
            await websocket.close()
            return

        preferred_language = init_data.get("preferred_language", "en")
        manager.user_info[websocket] = {
            "username": username,
            "preferred_language": preferred_language,
        }

        await websocket.send_json({
            "info": f"Joined room {room} as {username} with language {preferred_language}"
        })

        while True:
            data = await websocket.receive_json()

            if data.get("type") == "update_language":
                new_lang = data.get("preferred_language", "en")
                manager.user_info[websocket]["preferred_language"] = new_lang
                await websocket.send_json({"info": f"Language updated to {new_lang}"})
                continue

            if data.get("type") == "file":
                # File messages are just for display, skip processing here
                continue

            content = data["content"]
            detected_language = await detect_language(content)

            msg = MessageCreate(
                username=username,
                room=room,
                content=content,
                timestamp=datetime.now(),
            )
            Message.create(db, msg)

            await manager.broadcast(room, {
                **json.loads(msg.json()),
                "detected_language": detected_language,
                "original_content": content,
                "original_language": detected_language
            }, sender_ws=websocket)

    except WebSocketDisconnect:
        print(f"❌ {username} disconnected from {room}")
        manager.disconnect(room, websocket)

    except Exception as e:
        print(f"❌ Unexpected WebSocket error: {e}")
        manager.disconnect(room, websocket)

# --- Room Message History ---
@app.get("/history/{room}")
def get_history(room: str, db=Depends(get_db)):
    messages = Message.get_by_room(db, room)
    return JSONResponse([
        MessageCreate.model_validate(m, from_attributes=True).model_dump(mode="json")
        for m in messages
    ])

# --- Room Reset ---
@app.post("/create-room/{room}")
def create_room(room: str, db=Depends(get_db)):
    print(f"[CREATE ROOM] Resetting history for room: {room}")
    Message.delete_by_room(db, room)
    return JSONResponse(
        {"message": f"Room '{room}' created/reset."},
        status_code=status.HTTP_201_CREATED
    )

# --- Voice Translation Endpoint ---
@app.post("/voice-translate")
async def voice_translate(
    audio_file: UploadFile = File(...),
    source_lang: str = Form('hi'),
    target_lang: str = Form('en')
):
    # Save uploaded audio temporarily
    temp_input_path = f"temp_{uuid.uuid4()}.wav"
    with open(temp_input_path, "wb") as f:
        content = await audio_file.read()
        f.write(content)

    # Speech to text
    spoken_text = speech_to_text(temp_input_path, language_code=source_lang)

    # Translate text
    translated_text = vt_translate_text(spoken_text, src_lang=source_lang, target_lang=target_lang)

    # TTS for translated text
    output_audio_path = f"translated_{uuid.uuid4()}.mp3"
    speak_text(translated_text, lang=target_lang, filename=output_audio_path)

    # Encode output audio to base64
    with open(output_audio_path, "rb") as audio_f:
        audio_bytes = audio_f.read()
        audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')

    # Clean up
    os.remove(temp_input_path)
    os.remove(output_audio_path)

    return JSONResponse({
        "translated_text": translated_text,
        "audio_base64": audio_base64
    })

@app.post("/voice_message")
async def voice_message(
    audio: UploadFile = File(...),
    username: str = Form(...),
    room: str = Form(...),
    preferred_language: str = Form('en'),
):
    print("[voice_message] Received request:", username, room, preferred_language)
    print(f"[voice_message] Uploaded file: filename={audio.filename}, content_type={audio.content_type}")
    # Read the file content to get its size
    file_content = await audio.read()
    print(f"[voice_message] Uploaded file size: {len(file_content)} bytes")
    import uuid
    import os
    import base64
    import tempfile
    import subprocess
    from .voice_translator import speech_to_text, translate_text, speak_text
    from fastapi import WebSocket
    from datetime import datetime

    # Save uploaded audio with original extension
    orig_ext = os.path.splitext(audio.filename)[-1].lower() or '.webm'
    temp_dir = tempfile.gettempdir()
    temp_input_path = os.path.join(temp_dir, f"input_{uuid.uuid4()}{orig_ext}")
    try:
        with open(temp_input_path, "wb") as f:
            f.write(file_content)
        print(f"[voice_message] Audio saved to {temp_input_path}")
        print(f"[voice_message] Saved file size: {os.path.getsize(temp_input_path)} bytes")
    except Exception as e:
        print(f"[voice_message] Failed to save audio: {e}")
        return JSONResponse({"error": f"Failed to save audio: {e}"}, status_code=500)

    # Always convert to wav using ffmpeg
    temp_wav_path = os.path.join(temp_dir, f"converted_{uuid.uuid4()}.wav")
    try:
        print(f"[voice_message] Converting {temp_input_path} to {temp_wav_path} using ffmpeg...")
        result = subprocess.run([
            'ffmpeg', '-y', '-i', temp_input_path, '-ar', '16000', '-ac', '1', temp_wav_path
        ], capture_output=True, text=True)
        if result.returncode != 0:
            print(f"[voice_message] ffmpeg error: {result.stderr}")
            os.remove(temp_input_path)
            return JSONResponse({"error": f"ffmpeg conversion failed: {result.stderr}"}, status_code=500)
        print(f"[voice_message] Conversion successful: {temp_wav_path}")
    except Exception as e:
        print(f"[voice_message] ffmpeg exception: {e}")
        os.remove(temp_input_path)
        return JSONResponse({"error": f"ffmpeg exception: {e}"}, status_code=500)

    # Speech to text
    try:
        spoken_text = speech_to_text(temp_wav_path, language_code=preferred_language)
        print(f"[voice_message] STT result: {spoken_text}")
    except Exception as e:
        print(f"[voice_message] Speech-to-text failed: {e}")
        if os.path.exists(temp_input_path): os.remove(temp_input_path)
        if os.path.exists(temp_wav_path): os.remove(temp_wav_path)
        return JSONResponse({"error": f"Speech-to-text failed: {e}"}, status_code=500)

    # Detect language (use preferred_language as fallback)
    detected_language = preferred_language
    if spoken_text.strip():
        try:
            from .main import detect_language
            detected_language = await detect_language(spoken_text)
            print(f"[voice_message] Detected language: {detected_language}")
        except Exception as e:
            print(f"[voice_message] Language detection failed: {e}")
            pass

    # For each user in the room, send translated message and audio
    if room in manager.active_connections:
        for ws in manager.active_connections[room]:
            user_info = manager.user_info.get(ws, {})
            user_lang = user_info.get("preferred_language", "en")
            print(f"[voice_message] Preparing message for user {user_info.get('username')} (lang: {user_lang})")
            # Translate if needed
            if user_lang != detected_language:
                try:
                    translated_text = translate_text(spoken_text, src_lang=detected_language, target_lang=user_lang)
                    print(f"[voice_message] Translated text: {translated_text}")
                except Exception as e:
                    print(f"[voice_message] Translation failed: {e}")
                    translated_text = spoken_text
            else:
                translated_text = spoken_text
            # TTS for translated text
            temp_output_path = os.path.join(temp_dir, f"tts_{uuid.uuid4()}.mp3")
            try:
                speak_text(translated_text, lang=user_lang, filename=temp_output_path)
                print(f"[voice_message] TTS audio saved to {temp_output_path}")
                with open(temp_output_path, "rb") as audio_f:
                    audio_bytes = audio_f.read()
                    audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
            except Exception as e:
                print(f"[voice_message] TTS failed: {e}")
                audio_base64 = None
            finally:
                if os.path.exists(temp_output_path):
                    os.remove(temp_output_path)
            # Send via WebSocket
            msg = {
                "username": username,
                "room": room,
                "content": translated_text,
                "audio_base64": audio_base64,
                "timestamp": datetime.utcnow().isoformat(),
                "detected_language": detected_language,
                "original_content": spoken_text,
                "original_language": detected_language
            }
            try:
                await ws.send_json(msg)
                print(f"[voice_message] Sent message to {user_info.get('username')}")
            except Exception as e:
                print(f"[voice_message] Error sending to user {user_info.get('username')}: {e}")
    else:
        print(f"[voice_message] No active connections in room {room}")
    # Clean up
    if os.path.exists(temp_input_path):
        os.remove(temp_input_path)
    if os.path.exists(temp_wav_path):
        os.remove(temp_wav_path)
    print("[voice_message] Done.")
    return JSONResponse({"status": "ok"})

# --- File Upload Endpoint ---
@app.post('/upload_file')
async def upload_file(file: UploadFile = File(...), room: str = Form(...), username: str = Form(...)):
    ext = os.path.splitext(file.filename)[-1]
    file_id = f"{uuid.uuid4().hex}{ext}"
    save_path = os.path.join(UPLOAD_DIR, file_id)
    file.file.seek(0)  # Reset pointer to start for repeated uploads
    with open(save_path, 'wb') as f:
        shutil.copyfileobj(file.file, f)
    # Store mapping of file_id to original filename
    mapping_path = os.path.join(UPLOAD_DIR, 'file_map.json')
    try:
        with open(mapping_path, 'r') as m:
            file_map = json.load(m)
    except Exception:
        file_map = {}
    file_map[file_id] = file.filename
    with open(mapping_path, 'w') as m:
        json.dump(file_map, m)

    # Build file URL (relative to static mount)
    file_url = f"/static/uploads/{file_id}"

    # Notify all users in the room via WebSocket
    msg = {
        "type": "file",
        "username": username,
        "room": room,
        "file_name": file.filename,
        "file_id": file_id,
        "file_url": file_url,
        "timestamp": datetime.utcnow().isoformat(),
    }
    await manager.broadcast(room, msg)

    return {
        "file_id": file_id,
        "filename": file.filename,
        "file_url": file_url
    }

# --- File Download Endpoint ---
@app.get('/download_file/{file_id}')
async def download_file(file_id: str):
    file_path = os.path.join(UPLOAD_DIR, file_id)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    # Get original filename from mapping
    mapping_path = os.path.join(UPLOAD_DIR, 'file_map.json')
    try:
        with open(mapping_path, 'r') as m:
            file_map = json.load(m)
        filename = file_map.get(file_id, file_id)
    except Exception:
        filename = file_id
    return FileResponse(file_path, filename=filename, media_type='application/octet-stream')

@app.get('/supported_languages')
def supported_languages():
    """Return all supported languages as a dict: {code: name}"""
    return LANGUAGES
