import json

from agents import Agent, RawResponsesStreamEvent, RunItemStreamEvent, Runner
from agents.extensions.memory import SQLAlchemySession
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from openai.types.responses import (
    ResponseFunctionToolCall,
    ResponseReasoningItem,
    ResponseTextDeltaEvent,
)
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
        # Track reasoning state to avoid duplicates
        reasoning_buffer = ""

        async for event in runner.stream_events():
            if event.type == "raw_response_event" and isinstance(
                event, RawResponsesStreamEvent
            ):
                data = event.data

                # Handle text deltas
                if isinstance(data, ResponseTextDeltaEvent) and data.delta:
                    text_data = {"type": "text_delta", "delta": data.delta}
                    yield f"data: {json.dumps(text_data)}\n\n"

                # Handle reasoning deltas - accumulate and emit only new text
                elif hasattr(data, "type") and "reasoning" in str(data.type).lower():
                    reasoning_text = ""

                    if hasattr(data, "text") and data.text:
                        reasoning_text = data.text
                    elif hasattr(data, "delta") and data.delta:
                        reasoning_text = data.delta

                    if reasoning_text and isinstance(reasoning_text, str):
                        # Check if this is new text or overlapping
                        if reasoning_text.startswith(reasoning_buffer) and len(
                            reasoning_text
                        ) > len(reasoning_buffer):
                            # Only emit the new portion
                            new_text = reasoning_text[len(reasoning_buffer) :]
                            if new_text:
                                reasoning_data = {"type": "reasoning", "text": new_text}
                                yield f"data: {json.dumps(reasoning_data)}\n\n"
                            reasoning_buffer = reasoning_text
                        elif reasoning_text not in reasoning_buffer:
                            # Completely new text, emit all
                            reasoning_data = {
                                "type": "reasoning",
                                "text": reasoning_text,
                            }
                            yield f"data: {json.dumps(reasoning_data)}\n\n"
                            reasoning_buffer = reasoning_text

                # Handle complete reasoning item - only if we haven't streamed it
                elif isinstance(data, ResponseReasoningItem):
                    reasoning_text = ""
                    if data.summary:
                        for summary_item in data.summary:
                            if hasattr(summary_item, "text") and summary_item.text:
                                reasoning_text += summary_item.text

                    # Only emit if different from what we've already sent
                    if reasoning_text and reasoning_text != reasoning_buffer:
                        reasoning_data = {"type": "reasoning", "text": reasoning_text}
                        yield f"data: {json.dumps(reasoning_data)}\n\n"
                        reasoning_buffer = reasoning_text

            elif isinstance(event, RunItemStreamEvent):
                if event.name == "tool_called" and isinstance(
                    event.item.raw_item, ResponseFunctionToolCall
                ):
                    yield f"data: {json.dumps({'type': 'tool_call', 'tool_name': event.item.raw_item.name, 'argument': event.item.raw_item.arguments, 'call_id': event.item.raw_item.call_id})}\n\n"  # noqa: E501

                elif event.name == "tool_output":
                    output = ""
                    if hasattr(event.item, "output"):
                        output = str(event.item.output) if event.item.output else ""
                    elif hasattr(event.item.raw_item, "output"):
                        output = (
                            str(event.item.raw_item.output)
                            if event.item.raw_item.output
                            else ""
                        )

                    call_id = None
                    if hasattr(event.item.raw_item, "call_id"):
                        call_id = event.item.raw_item.call_id

                    if output:
                        yield f"data: {json.dumps({'type': 'tool_result', 'call_id': call_id, 'output': output})}\n\n"  # noqa: E501

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )


@router.post("/clear")
async def clear_session():
    async with engine.begin() as conn:
        await conn.execute(
            text("DELETE FROM agent_messages WHERE session_id = :sid"),
            {"sid": SESSION_ID},
        )
    return {"status": "ok"}
