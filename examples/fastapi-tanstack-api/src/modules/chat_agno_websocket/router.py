import asyncio
import json
import logging
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from src.modules.chat_agno.agent import get_agent

router = APIRouter(prefix="/api/chat-agno-websocket", tags=["chat-agno-websocket"])

SESSION_ID = "default-agno-websocket"
logger = logging.getLogger(__name__)


@dataclass
class JobEvent:
    event_id: int
    payload: dict[str, Any]


@dataclass
class SocketJob:
    job_id: str
    message: str
    session_id: str
    status: str = "pending"
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    finished_at: datetime | None = None
    error: str | None = None
    done: bool = False
    events: list[JobEvent] = field(default_factory=list)
    condition: asyncio.Condition = field(default_factory=asyncio.Condition)
    task: asyncio.Task[None] | None = None


jobs: dict[str, SocketJob] = {}


class ActiveRunResponse(BaseModel):
    run_id: str | None = None
    status: str | None = None
    message: str | None = None
    events: list[dict[str, Any]] = []


def _append_event(job: SocketJob, payload: dict[str, Any]) -> None:
    job.events.append(JobEvent(event_id=len(job.events), payload=payload))


async def _publish(job: SocketJob, payload: dict[str, Any]) -> None:
    async with job.condition:
        _append_event(job, payload)
        job.condition.notify_all()


async def _stream_agno_job(job: SocketJob) -> None:
    agent = get_agent(job.session_id)
    job.status = "running"
    reasoning_buffer = ""

    try:
        async for event in agent.arun(
            job.message,
            stream=True,
            stream_events=True,
        ):
            if not hasattr(event, "event"):
                continue

            event_type = event.event

            if event_type == "RunContent":
                if hasattr(event, "reasoning_content") and event.reasoning_content:
                    reasoning_text = str(event.reasoning_content)
                    if reasoning_text.startswith(reasoning_buffer) and len(
                        reasoning_text
                    ) > len(reasoning_buffer):
                        new_text = reasoning_text[len(reasoning_buffer) :]
                        if new_text:
                            await _publish(
                                job,
                                {"type": "reasoning", "text": new_text},
                            )
                        reasoning_buffer = reasoning_text
                    elif reasoning_text not in reasoning_buffer:
                        await _publish(
                            job,
                            {"type": "reasoning", "text": reasoning_text},
                        )
                        reasoning_buffer = reasoning_text
                elif hasattr(event, "content") and event.content:
                    await _publish(
                        job,
                        {"type": "text_delta", "delta": event.content},
                    )

            elif event_type == "ToolCallStarted":
                if hasattr(event, "tool") and event.tool:
                    tool_data = event.tool
                    if hasattr(tool_data, "tool_name"):
                        tool_name = tool_data.tool_name
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

                        try:
                            args_dict = json.loads(arguments)
                            if "label" in args_dict:
                                args_dict["name"] = tool_name
                                arguments = json.dumps(args_dict)
                        except (json.JSONDecodeError, TypeError, ValueError):
                            pass

                        await _publish(
                            job,
                            {
                                "type": "tool_call",
                                "tool_name": tool_name,
                                "argument": arguments,
                                "call_id": getattr(tool_data, "call_id", None),
                            },
                        )

            elif event_type == "ToolCallCompleted":
                if hasattr(event, "tool") and event.tool:
                    tool_data = event.tool
                    output = ""

                    if hasattr(tool_data, "output") and tool_data.output:
                        output = str(tool_data.output)
                    elif hasattr(tool_data, "result") and tool_data.result:
                        output = str(tool_data.result)

                    if output:
                        await _publish(
                            job,
                            {
                                "type": "tool_result",
                                "call_id": getattr(tool_data, "call_id", None),
                                "output": output,
                            },
                        )

        job.status = "completed"
        job.finished_at = datetime.now(UTC)
        job.done = True
        await _publish(job, {"type": "done"})
    except asyncio.CancelledError:
        job.status = "cancelled"
        job.finished_at = datetime.now(UTC)
        job.done = True
        await _publish(job, {"type": "done"})
    except Exception as exc:
        job.status = "failed"
        job.error = str(exc)
        job.finished_at = datetime.now(UTC)
        job.done = True
        await _publish(job, {"type": "error", "message": str(exc)})


def _decode_message(payload: Any) -> tuple[str | None, str | None, int]:
    if not isinstance(payload, dict):
        raise ValueError("Expected a JSON object payload")

    message = payload.get("message")
    run_id = payload.get("runId") or payload.get("job_id")
    last_event_id = payload.get("lastEventId", -1)

    if message is not None and not isinstance(message, str):
        raise ValueError("`message` must be a string")
    if run_id is not None and not isinstance(run_id, str):
        raise ValueError("`runId` must be a string")
    if not isinstance(last_event_id, int):
        raise ValueError("`lastEventId` must be an integer")

    return message, run_id, last_event_id


async def _stream_job_to_socket(
    websocket: WebSocket, job: SocketJob, last_event_id: int = -1
) -> None:
    next_index = last_event_id + 1

    while True:
        async with job.condition:
            while next_index >= len(job.events) and not job.done:
                await job.condition.wait()

            pending_events = job.events[next_index:]
            is_done = job.done and next_index >= len(job.events)

        for item in pending_events:
            await websocket.send_json(item.payload)
            next_index = item.event_id + 1

        if is_done:
            break


@router.get("/")
async def get_history():
    agent = get_agent(SESSION_ID)
    try:
        messages = await agent.aget_session_messages(session_id=SESSION_ID)
        return messages
    except Exception:
        return []


@router.get("/active-run", response_model=ActiveRunResponse)
async def get_active_run():
    active_jobs = [
        job
        for job in jobs.values()
        if job.session_id == SESSION_ID and not job.done
    ]

    if not active_jobs:
        return ActiveRunResponse()

    latest_job = max(active_jobs, key=lambda job: job.created_at)
    return ActiveRunResponse(
        run_id=latest_job.job_id,
        status=latest_job.status,
        message=latest_job.message,
        events=[item.payload for item in latest_job.events],
    )


@router.post("/jobs/{job_id}/cancel")
async def cancel_job(job_id: str):
    job = jobs.get(job_id)
    if job and job.task and not job.done:
        logger.info("HTTP cancelling run %s", job_id)
        job.task.cancel()
    return {"status": "ok"}


@router.post("/clear")
async def clear_session():
    agent = get_agent(SESSION_ID)
    try:
        if agent.db:
            result = agent.db.delete_session(session_id=SESSION_ID)
            if hasattr(result, "__await__"):
                await result
    except Exception:
        pass

    finished_jobs = [
        job_id
        for job_id, job in jobs.items()
        if job.session_id == SESSION_ID and job.done
    ]
    for job_id in finished_jobs:
        jobs.pop(job_id, None)

    return {"status": "ok"}


@router.websocket("/ws")
async def chat_websocket(websocket: WebSocket):
    await websocket.accept()

    try:
        while True:
            payload = await websocket.receive_json()
            logger.info("WebSocket received payload: %s", payload)
            message, run_id, last_event_id = _decode_message(payload)

            if run_id:
                job = jobs.get(run_id)
                if job is None:
                    await websocket.send_json(
                        {"type": "error", "message": "Run not found"}
                    )
                    continue
                logger.info(
                    "WebSocket reconnect for run %s from event %s "
                    "(buffer size=%s, done=%s)",
                    run_id,
                    last_event_id,
                    len(job.events),
                    job.done,
                )
            elif message:
                run_id = str(uuid.uuid4())
                job = SocketJob(
                    job_id=run_id,
                    message=message,
                    session_id=SESSION_ID,
                )
                jobs[run_id] = job
                _append_event(job, {"type": "run_started", "runId": run_id})
                logger.info("WebSocket started new run %s", run_id)
                job.task = asyncio.create_task(_stream_agno_job(job))
            else:
                await websocket.send_json(
                    {
                        "type": "error",
                        "message": "Expected either `message` or `runId` in payload",
                    }
                )
                continue

            await _stream_job_to_socket(websocket, job, last_event_id=last_event_id)
    except WebSocketDisconnect:
        return
    except ValueError as exc:
        await websocket.send_json({"type": "error", "message": str(exc)})
        await websocket.close(code=1003, reason=str(exc))
    except Exception as exc:
        await websocket.send_json({"type": "error", "message": str(exc)})
        await websocket.close(code=1011, reason="Unexpected server error")
