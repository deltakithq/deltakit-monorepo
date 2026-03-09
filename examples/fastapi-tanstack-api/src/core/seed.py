from sqlalchemy.ext.asyncio.session import AsyncSession
from sqlmodel import select

from src.core.engine import engine
from src.modules.session.schema import ChatSession

SEED_SESSIONS = [
    ChatSession(title="Help with TypeScript generics"),
    ChatSession(title="React state management"),
    ChatSession(title="CSS Grid vs Flexbox"),
    ChatSession(title="Database indexing strategies"),
]


async def seed_sessions() -> None:
    async with AsyncSession(engine) as db:
        result = await db.execute(select(ChatSession).limit(1))
        if result.scalars().first() is not None:
            return

        for session in SEED_SESSIONS:
            db.add(session)
        await db.commit()
