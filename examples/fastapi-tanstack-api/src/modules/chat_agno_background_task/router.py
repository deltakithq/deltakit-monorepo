import asyncio
import json
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from src.modules.chat_agno.agent import get_agent
from src.modules.chat_agno.schema import ChatRequest

router = APIRouter(
    prefix="/api/chat-agno-background-task",
    tags=["chat-agno-background-task"],
)

SESSION_ID = "default-agno-background-task"


class JobCreatedResponse(BaseModel):
    job_id: str
    status: str


class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    created_at: str
    started_at: str | None = None
    finished_at: str | None = None
    error: str | None = None


@dataclass
class JobEvent:
    event_id: int
    payload: dict[str, Any]


@dataclass
class BackgroundJob:
    job_id: str
    message: str
    session_id: str
    status: str = "pending"
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    started_at: datetime | None = None
    finished_at: datetime | None = None
    error: str | None = None
    events: list[JobEvent] = field(default_factory=list)
    done: bool = False
    task: asyncio.Task[None] | None = None
    condition: asyncio.Condition = field(default_factory=asyncio.Condition)


jobs: dict[str, BackgroundJob] = {}


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _append_event(job: BackgroundJob, payload: dict[str, Any]) -> None:
    job.events.append(JobEvent(event_id=len(job.events), payload=payload))


async def _publish(job: BackgroundJob, payload: dict[str, Any]) -> None:
    async with job.condition:
        _append_event(job, payload)
        job.condition.notify_all()


async def _stream_agno_job(job: BackgroundJob) -> None:
    agent = get_agent(job.session_id)
    job.status = "running"
    job.started_at = datetime.now(UTC)

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


def _get_job(job_id: str) -> BackgroundJob:
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/")
async def get_history():
    agent = get_agent(SESSION_ID)
    try:
        messages = await agent.aget_session_messages(session_id=SESSION_ID)
        return messages
    except Exception:
        return []


@router.post("/jobs", response_model=JobCreatedResponse)
async def create_job(request: ChatRequest):
    job_id = str(uuid.uuid4())
    job = BackgroundJob(
        job_id=job_id,
        message=request.message,
        session_id=SESSION_ID,
    )
    jobs[job_id] = job
    job.task = asyncio.create_task(_stream_agno_job(job))
    return JobCreatedResponse(job_id=job_id, status=job.status)


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    job = _get_job(job_id)
    return JobStatusResponse(
        job_id=job.job_id,
        status=job.status,
        created_at=_iso(job.created_at) or "",
        started_at=_iso(job.started_at),
        finished_at=_iso(job.finished_at),
        error=job.error,
    )


@router.post("/jobs/{job_id}/cancel")
async def cancel_job(job_id: str):
    job = _get_job(job_id)
    if job.task and not job.done:
        job.task.cancel()
    return {"status": "ok"}


@router.get("/jobs/{job_id}/events")
async def stream_job_events(job_id: str, last_event_id: int = -1):
    job = _get_job(job_id)

    async def event_generator():
        next_index = last_event_id + 1

        while True:
            async with job.condition:
                while next_index >= len(job.events) and not job.done:
                    await job.condition.wait()

                pending_events = job.events[next_index:]
                is_done = job.done and next_index >= len(job.events)

            for item in pending_events:
                yield f"id: {item.event_id}\n"
                yield f"data: {json.dumps(item.payload)}\n\n"
                next_index = item.event_id + 1

            if is_done:
                break

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
