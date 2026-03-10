import json

from agents import Agent, RawResponsesStreamEvent, RunItemStreamEvent, Runner
from agents.extensions.memory import SQLAlchemySession
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from openai.types.responses import ResponseFunctionToolCall, ResponseTextDeltaEvent
from sqlalchemy import text

from src.core.engine import engine
from src.modules.agents.models import llm_model
from src.modules.agents.prompt import SYSTEM_PROMPT
from src.modules.agents.tools import crawl_website, extract_webpage, search_web
from src.modules.chat.schema import ChatRequest

router = APIRouter(prefix="/api/chat", tags=["chat"])

SESSION_ID = "default"


@router.get("/")
async def get_history():
    session = SQLAlchemySession(
        session_id=SESSION_ID,
        engine=engine,
        create_tables=True,
    )
    items = await session.get_items()
    return items


@router.post("/")
async def generate_answer(request: ChatRequest):
    session = SQLAlchemySession(
        session_id=SESSION_ID,
        engine=engine,
        create_tables=True,
    )

    agent = Agent(
        "Assistant",
        instructions=SYSTEM_PROMPT,
        model=llm_model,
        tools=[search_web, crawl_website, extract_webpage],
    )
    runner = Runner.run_streamed(
        agent, input=request.message, session=session, max_turns=30
    )

    async def event_generator():
        async for event in runner.stream_events():
            if event.type == "raw_response_event" and isinstance(
                event, RawResponsesStreamEvent
            ):
                if (
                    isinstance(event.data, ResponseTextDeltaEvent)
                    and event.data.delta != ""
                ):
                    yield f"data: {json.dumps({'type': 'text_delta', 'delta': event.data.delta})}\n\n"  # noqa: E501

            elif isinstance(event, RunItemStreamEvent):
                if event.name == "tool_called" and isinstance(
                    event.item.raw_item, ResponseFunctionToolCall
                ):
                    yield f"data: {json.dumps({'type': 'tool_call', 'tool_name': event.item.raw_item.name, 'argument': event.item.raw_item.arguments})}\n\n"  # noqa: E501

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/clear")
async def clear_session():
    async with engine.begin() as conn:
        await conn.execute(
            text("DELETE FROM agent_messages WHERE session_id = :sid"),
            {"sid": SESSION_ID},
        )
    return {"status": "ok"}
