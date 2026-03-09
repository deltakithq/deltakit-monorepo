from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio.session import AsyncSession

from src.core.engine import get_db
from src.modules.session.schema import ChatSession

router = APIRouter(prefix="/api/chat-sessions", tags=["sessions"])


@router.post("/")
async def create_session(db: AsyncSession = Depends(get_db)):
    new_session = ChatSession()
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    return new_session
