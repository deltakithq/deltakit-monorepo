import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from src.modules.chat_agno.agent import get_agent
from src.modules.chat_agno.schema import ChatRequest

router = APIRouter(prefix="/api/chat-agno", tags=["chat-agno"])

SESSION_ID = "default-agno"


@router.get("/")
async def get_history():
    """Get chat history for the current session."""
    agent = get_agent(SESSION_ID)
    # Get messages from the agent's session
    try:
        messages = await agent.aget_session_messages(session_id=SESSION_ID)
        return messages
    except Exception:
        # Session doesn't exist yet, return empty list
        return []


@router.post("/")
async def generate_answer(request: ChatRequest):
    """Stream chat response using Agno agent."""
    agent = get_agent(SESSION_ID)

    async def event_generator():
        # Track reasoning state to avoid duplicates
        reasoning_buffer = ""

        # Run the agent with streaming
        async for event in agent.arun(
            request.message,
            stream=True,
            stream_events=True,
        ):
            if not hasattr(event, "event"):
                continue

            event_type = event.event

            # Handle content (text) events - both reasoning and regular content
            if event_type == "RunContent":
                # Check for reasoning content first
                if hasattr(event, "reasoning_content") and event.reasoning_content:
                    reasoning_text = str(event.reasoning_content)
                    # Check if this is new text or overlapping
                    if reasoning_text.startswith(reasoning_buffer) and len(
                        reasoning_text
                    ) > len(reasoning_buffer):
                        # Only emit the new portion
                        new_text = reasoning_text[len(reasoning_buffer) :]
                        if new_text:
                            yield f"data: {json.dumps({'type': 'reasoning', 'text': new_text})}\n\n"  # noqa: E501
                        reasoning_buffer = reasoning_text
                    elif reasoning_text not in reasoning_buffer:
                        # Completely new text, emit all
                        yield f"data: {json.dumps({'type': 'reasoning', 'text': reasoning_text})}\n\n"  # noqa: E501
                        reasoning_buffer = reasoning_text
                # Then check for regular content
                elif hasattr(event, "content") and event.content:
                    yield f"data: {json.dumps({'type': 'text_delta', 'delta': event.content})}\n\n"  # noqa: E501

            # Handle tool call started events
            elif event_type == "ToolCallStarted":
                if hasattr(event, "tool") and event.tool:
                    tool_data = event.tool
                    if hasattr(tool_data, "tool_name"):
                        tool_name = tool_data.tool_name
                        # Get the arguments
                        arguments = "{}"
                        if hasattr(tool_data, "arguments"):
                            try:
                                arguments = json.dumps(tool_data.arguments)
                            except (TypeError, ValueError):
                                arguments = str(tool_data.arguments)
                        elif hasattr(tool_data, "arguments_dict"):
                            try:
                                arguments = json.dumps(tool_data.arguments_dict)
                            except (TypeError, ValueError):
                                arguments = str(tool_data.arguments_dict)

                        # Include label if present
                        try:
                            args_dict = json.loads(arguments)
                            if "label" in args_dict:
                                args_dict["name"] = tool_name
                                arguments = json.dumps(args_dict)
                        except (json.JSONDecodeError, TypeError, ValueError):
                            pass

                        call_id = getattr(tool_data, "call_id", None)
                        yield f"data: {json.dumps({'type': 'tool_call', 'tool_name': tool_name, 'argument': arguments, 'call_id': call_id})}\n\n"  # noqa: E501

            # Handle tool call completed events (tool results)
            elif event_type == "ToolCallCompleted":
                if hasattr(event, "tool") and event.tool:
                    tool_data = event.tool
                    call_id = getattr(tool_data, "call_id", None)
                    output = ""

                    if hasattr(tool_data, "output") and tool_data.output:
                        output = str(tool_data.output)
                    elif hasattr(tool_data, "result") and tool_data.result:
                        output = str(tool_data.result)

                    if output:
                        yield f"data: {json.dumps({'type': 'tool_result', 'call_id': call_id, 'output': output})}\n\n"  # noqa: E501

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/clear")
async def clear_session():
    """Clear the current session's chat history."""
    agent = get_agent(SESSION_ID)
    try:
        if agent.db:
            # delete_session may be sync or async depending on db type
            result = agent.db.delete_session(session_id=SESSION_ID)
            if hasattr(result, "__await__"):
                await result
    except Exception:
        # Session might not exist, ignore error
        pass
    return {"status": "ok"}
