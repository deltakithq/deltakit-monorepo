from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio.session import AsyncSession
from sqlmodel import select

from src.core.engine import get_db
from src.modules.session.schema import ChatSession

router = APIRouter(prefix="/api/chat-sessions", tags=["sessions"])


@router.get("/")
async def list_sessions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ChatSession))
    return result.scalars().all()


@router.post("/")
async def create_session(db: AsyncSession = Depends(get_db)):
    new_session = ChatSession()
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    return new_session
