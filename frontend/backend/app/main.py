from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .db import get_db, init_db
from .models import Message
from .schemas import MessageCreate
import asyncio
from typing import Dict, List
from datetime import datetime
import json
from googletrans import Translator
from fastapi import status

app = FastAPI()

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory connection manager for WebSockets per room
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
                translated_content = message["content"]
                if preferred_language != message.get("detected_language", "en"):
                    translated_content = await translate_text(message["content"], preferred_language)
                msg_to_send = message.copy()
                msg_to_send["content"] = translated_content
                try:
                    await connection.send_json(msg_to_send)
                    print(f"📢 Sent to {user_info.get('username')}: {translated_content}")
                except Exception as e:
                    print(f"❌ Error sending to user: {e}")

manager = ConnectionManager()
translator = Translator()

async def translate_text(text, dest_lang):
    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(None, lambda: translator.translate(text, dest=dest_lang))
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

@app.on_event("startup")
def on_startup():
    init_db()
    print("[STARTED] Server is up and database initialized.")

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
            await websocket.close()
            return

        preferred_language = init_data.get("preferred_language", "en")
        manager.user_info[websocket] = {"username": username, "preferred_language": preferred_language}
        await websocket.send_json({"info": f"Joined room {room} as {username} with language {preferred_language}"})

        while True:
            data = await websocket.receive_json()

            # Handle language change
            if data.get("type") == "update_language":
                new_lang = data.get("preferred_language", "en")
                manager.user_info[websocket]["preferred_language"] = new_lang
                await websocket.send_json({"info": f"Language updated to {new_lang}"})
                continue

            content = data["content"]
            detected_language = await detect_language(content)
            original_content = content

            if detected_language != preferred_language:
                content = await translate_text(content, preferred_language)

            msg = MessageCreate(
                username=username,
                room=room,
                content=content,
                timestamp=datetime.utcnow()
            )
            Message.create(db, msg)

            await manager.broadcast(room, {
                **json.loads(msg.json()),
                "detected_language": detected_language,
                "original_content": original_content,
                "original_language": detected_language
            }, sender_ws=websocket)

    except WebSocketDisconnect:
        print(f"❌ {username} disconnected from {room}")
        manager.disconnect(room, websocket)
    except Exception as e:
        print(f"❌ Unexpected WebSocket error: {e}")
        manager.disconnect(room, websocket)

@app.get("/history/{room}")
def get_history(room: str, db=Depends(get_db)):
    messages = Message.get_by_room(db, room)
    return JSONResponse([
        MessageCreate.model_validate(m, from_attributes=True).model_dump(mode="json")
        for m in messages
    ])

@app.post("/create-room/{room}")
def create_room(room: str, db=Depends(get_db)):
    print(f"[CREATE ROOM] Resetting history for room: {room}")
    Message.delete_by_room(db, room)
    return JSONResponse({"message": f"Room '{room}' created/reset."}, status_code=status.HTTP_201_CREATED)
