from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.core.seed import seed_sessions
from src.modules.session.router import router as session_router
from src.modules.chat.router import router as chat_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    await seed_sessions()
    yield


app = FastAPI(title="FastAPI Backend", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,  # type: ignore
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(session_router)
app.include_router(chat_router)


@app.get("/")
async def root():
    return {"message": "Hello from FastAPI!"}


@app.get("/api/health")
async def health():
    return {"status": "ok"}
