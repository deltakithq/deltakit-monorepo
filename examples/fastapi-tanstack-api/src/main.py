from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.modules.chat.router import router as chat_router

app = FastAPI(title="FastAPI Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,  # type: ignore
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)


@app.get("/")
async def root():
    return {"message": "Hello from FastAPI!"}


@app.get("/api/health")
async def health():
    return {"status": "ok"}
