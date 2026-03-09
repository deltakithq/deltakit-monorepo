import json

from agents import Agent, RawResponsesStreamEvent, RunItemStreamEvent, Runner
from agents.extensions.memory import SQLAlchemySession
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from openai.types.responses import ResponseFunctionToolCall, ResponseTextDeltaEvent

from src.core.engine import engine
from src.modules.agents.models import llm_model
from src.modules.agents.prompt import SYSTEM_PROMPT
from src.modules.agents.tools import search_web
from src.modules.chat.schema import ChatRequest

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("/")
async def generate_answer(request: ChatRequest):
    session = SQLAlchemySession(
        session_id=request.session_id,
        engine=engine,
        create_tables=True,
    )

    agent = Agent(
        "Assistant",
        instructions=SYSTEM_PROMPT,
        model=llm_model,
        tools=[search_web],
    )
    runner = Runner.run_streamed(agent, input=request.message, session=session)

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

            elif isinstance(event, RunItemStreamEvent) and event.name == "tool_called":
                if isinstance(event.item.raw_item, ResponseFunctionToolCall):
                    yield f"data: {json.dumps({'type': 'tool_call', 'tool_name': event.item.raw_item.name, 'argument': event.item.raw_item.arguments})}\n\n"  # noqa: E501

    return StreamingResponse(event_generator(), media_type="text/event-stream")
