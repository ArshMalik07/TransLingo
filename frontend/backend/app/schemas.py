from pydantic import BaseModel
from datetime import datetime

class MessageCreate(BaseModel):
    username: str
    room: str
    content: str
    timestamp: datetime

    class Config:
        from_attributes = True  # Pydantic v2+ only

class Message(BaseModel):
    username: str
    room: str
    content: str
    timestamp: datetime 