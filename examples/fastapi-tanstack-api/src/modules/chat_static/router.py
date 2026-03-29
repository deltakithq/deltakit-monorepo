import asyncio
import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/api/chat-static", tags=["chat-static"])

STATIC_TEXT = """\
# Markdown Streaming Torture Test

This fixture exercises **bold**, __double bold__, *italic*, _underscore italic_, ~~strikethrough~~, `inline code`, a [standard link](https://deltakit.dev), and an autolink https://example.com/docs/streaming-markdown.

---

## Heading Coverage

### Heading Level 3

#### Heading Level 4

##### Heading Level 5

###### Heading Level 6

Paragraph after deep headings so the renderer has to switch between block types while preserving **strong text**, *emphasis*, ~~deleted text~~, and nested formatting like **bold with _italic_ inside**.

## Blockquotes

> This is a top-level blockquote with **bold text** and a [link](https://example.com/quote).
>
> > This is a nested blockquote.
> > It contains `inline code` and more text.
>
> Back at the first quote level.

> A blockquote can also continue lazily
without the greater-than marker on the next line.

## Ordered List (flat)

1. First item
2. Second item
3. Third item

## Nested Ordered List

1. Planning Phase
   1. Gather requirements
   2. Define scope
   3. Create timeline
2. Development Phase
   1. Set up project structure
   2. Implement core features
   3. Write tests
   4. Code review
3. Deployment Phase
   1. Stage the release
   2. Run smoke tests
   3. Deploy to production
   4. Monitor metrics

## Mixed Nested List

1. Project Setup
   - Install Node.js
   - Clone the repository
   - Run `npm install`
2. Configuration
   - Create `.env` file
   - Set database credentials
   - Configure API keys
3. Verification
   - Check health endpoint
   - Confirm logs are clean

## Nested Unordered List

- Frontend
  - React
    - Hooks
    - Components
    - Suspense
  - Vue
  - Svelte
- Backend
  - Python
    - FastAPI
    - Async IO
  - Node.js
  - Go
- Infrastructure
  - Docker
  - Kubernetes

## List Items With Block Content

1. Release checklist

   Confirm the release notes are complete before shipping.

   ```bash
   pnpm install
   pnpm --filter @deltakit/markdown build
   pnpm --filter @examples/fastapi-tanstack-frontend dev
   ```

2. Database notes

   Additional nested items:

   - Apply migrations
   - Back up the database
   - Verify rollback instructions

## Fenced Code Blocks

```ts
type MessagePart =
	| { type: "text"; text: string }
	| { type: "image"; url: string };

export function appendChunk(previous: string, delta: string): string {
	return previous + delta;
}
```

~~~sql
SELECT id, role, created_at
FROM chat_messages
WHERE role IN ('user', 'assistant')
ORDER BY created_at DESC;
~~~

## Tables

### Simple Table

| Name | Type | Description |
|------|------|-------------|
| id | string | Unique identifier |
| role | enum | user or assistant |
| content | string | Markdown body with **inline formatting** |

### Alignment Table

| Column | Align Left | Align Center | Align Right |
|:-------|:----------:|-------------:|------------:|
| alpha | left | center | right |
| beta | `code` | [link](https://example.com) | https://example.com/right |

### Wide API Table

| Endpoint | Method | Auth | Request Body | Response | Notes |
|----------|--------|------|--------------|----------|-------|
| /api/chat-static/ | POST | none | `{ "message": "stream" }` | SSE event stream | Returns `text_delta` chunks followed by `done`. |
| /api/chat-static/clear | POST | none | empty | `{ "status": "ok" }` | Utility route for demos. |
| /api/messages | GET | bearer | none | JSON array | Example long description to force wrapping inside a streamed table cell. |

### Deployment Matrix

| Environment | Region | Replicas | Strategy | Health Check | Owner |
|-------------|--------|----------|----------|--------------|-------|
| development | ap-southeast-1 | 1 | recreate | `/healthz` | Platform Team |
| staging | us-east-1 | 2 | rolling | `/readyz` | Release Team |
| production | eu-west-1 | 6 | canary | `/livez` and `/readyz` | SRE |
| disaster-recovery | ap-northeast-1 | 2 | manual failover | `/healthz` | Operations |

### Feature Support Matrix

| Feature | Status | Example | Streaming Risk | Comments |
|---------|--------|---------|----------------|----------|
| headings | supported | `## Title` | low | Stable after newline. |
| blockquotes | supported | `> quote` | medium | Lazy continuation should stay grouped. |
| nested ordered lists | supported | `1. item` + `   1. subitem` | high | Previous bug reproduced here. |
| nested unordered lists | supported | `- item` + `  - child` | high | Useful for auto-scroll stress. |
| code fences | supported | ```ts | medium | Height can jump when fence closes. |
| tables | supported | `| a | b |` | high | Width and row growth can cause visible reflow. |
| images | supported | `![alt](url)` | medium | Skeleton-to-image swap changes layout. |

### Audit Log Table

| Timestamp | Actor | Action | Target | Result |
|-----------|-------|--------|--------|--------|
| 2026-03-29T09:00:00Z | system | stream_started | chat-static | ok |
| 2026-03-29T09:00:01Z | parser | heading_rendered | `# Markdown Streaming Torture Test` | ok |
| 2026-03-29T09:00:02Z | parser | list_extended | nested ordered list | ok |
| 2026-03-29T09:00:03Z | renderer | table_row_added | deployment matrix | ok |
| 2026-03-29T09:00:04Z | ui | autoscroll_adjusted | scroll container | ok |

## Images

Standalone image:

![Streaming placeholder](https://placehold.co/320x180/png?text=Streaming+Image)

Inline image in a sentence: logo ![Tiny mark](https://placehold.co/32x32/png?text=%E2%96%A0) continues after the image.

## Horizontal Rule Again

---

## Mixed Inline Formatting

You can combine **bold and _italic_ text**, include ~~deleted `inline code`~~, and place [links with **nested bold text**](https://deltakit.dev/docs) next to raw URLs like https://github.com/deltakithq.

## Final Notes

- All primary block types should appear above.
- All primary inline token types should appear above.
- Streaming should preserve nested structure while chunks arrive.

Done.
"""

CHUNK_SIZE = 3
CHUNK_DELAY = 0.035


@router.get("/")
async def get_history():
    return []


@router.post("/")
async def stream_static(_request: dict):
    async def event_generator():
        for i in range(0, len(STATIC_TEXT), CHUNK_SIZE):
            chunk = STATIC_TEXT[i : i + CHUNK_SIZE]
            event = {"type": "text_delta", "delta": chunk}
            yield f"data: {json.dumps(event)}\n\n"
            await asyncio.sleep(CHUNK_DELAY)

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

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
async def clear():
    return {"status": "ok"}
