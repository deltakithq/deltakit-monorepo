from sqlalchemy.ext.asyncio import create_async_engine

from src.core.settings import settings

engine = create_async_engine(url=settings.DATABASE_URL)
