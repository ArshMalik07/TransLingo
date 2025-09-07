from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import declarative_base
from .schemas import MessageCreate
from typing import List

Base = declarative_base()

class MessageORM(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, index=True)
    room = Column(String, index=True)
    content = Column(String)
    timestamp = Column(DateTime)

class Message:
    @staticmethod
    def create(db, msg: MessageCreate):
        db_msg = MessageORM(
            username=msg.username,
            room=msg.room,
            content=msg.content,
            timestamp=msg.timestamp
        )
        db.add(db_msg)
        db.commit()
        db.refresh(db_msg)
        return db_msg

    @staticmethod
    def get_by_room(db, room: str) -> List[MessageCreate]:
        return db.query(MessageORM).filter(MessageORM.room == room).order_by(MessageORM.timestamp).all()

    @staticmethod
    def delete_by_room(db, room: str):
        db.query(MessageORM).filter(MessageORM.room == room).delete()
        db.commit() 
