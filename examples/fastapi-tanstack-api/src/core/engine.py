from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.ext.asyncio.session import AsyncSession

from src.core.settings import DATABASE_URL

engine = create_async_engine(url=DATABASE_URL)


async def get_db():
    async with AsyncSession(engine) as session:
        yield session
