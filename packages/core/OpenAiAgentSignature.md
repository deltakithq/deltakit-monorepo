# OpenAI Agents SDK — Response Input Item Signatures

Reference for all 28 `TResponseInputItem` (`ResponseInputItemParam`) variants stored by
`SQLAlchemySession` in `agent_messages.message_data` (JSON-serialized, one row per item).

This document is intended as a mapping guide for converting these items into the
`@deltakit/react` `useChat` message format:

```ts
interface Message<TPart> {
  id: string;
  role: "user" | "assistant";
  parts: TPart[];
}
```

---

## Table of Contents

1. [Messages](#1-messages)
2. [Function Calls](#2-function-calls)
3. [Web Search](#3-web-search)
4. [File Search](#4-file-search)
5. [Computer Use](#5-computer-use)
6. [Shell Calls](#6-shell-calls)
7. [Code Interpreter](#7-code-interpreter)
8. [Image Generation](#8-image-generation)
9. [Apply Patch](#9-apply-patch)
10. [MCP (Model Context Protocol)](#10-mcp-model-context-protocol)
11. [Custom Tools](#11-custom-tools)
12. [Reasoning & Compaction](#12-reasoning--compaction)
13. [Tool Search](#13-tool-search)
14. [Item Reference](#14-item-reference)
15. [Persistence Pipeline](#15-persistence-pipeline)
16. [Conversion Strategy](#16-conversion-strategy-to-usechat)

---

## 1. Messages

### 1a. `EasyInputMessageParam` — type: `"message"`

Simple message format (string content allowed).

```python
{
    "type": "message",                                    # optional
    "role": "user" | "assistant" | "system" | "developer",  # required
    "content": str | list[ContentItem],                   # required
    "phase": "commentary" | "final_answer" | None,        # optional (codex models)
}
```

### 1b. `Message` — type: `"message"`

Strict message format (no string content, no `"assistant"` role).

```python
{
    "type": "message",                                       # optional
    "role": "user" | "system" | "developer",                 # required
    "content": list[ContentItem],                            # required
    "status": "in_progress" | "completed" | "incomplete",    # optional
}
```

### 1c. `ResponseOutputMessageParam` — type: `"message"`

Assistant output message replayed as input. **This is the most common assistant message type.**

```python
{
    "type": "message",                                       # required
    "id": str,                                               # required
    "role": "assistant",                                     # required (always "assistant")
    "status": "in_progress" | "completed" | "incomplete",    # required
    "content": list[OutputContent],                          # required
    "phase": "commentary" | "final_answer" | None,           # optional
}
```

**OutputContent variants:**

```python
# Text output
{
    "type": "output_text",
    "text": str,                    # required
    "annotations": list[Annotation],  # required (can be empty list)
    "logprobs": list[Logprob],      # optional
}

# Refusal
{
    "type": "refusal",
    "refusal": str,                 # required
}
```

**Annotation variants:**

```python
# URL citation
{"type": "url_citation", "url": str, "title": str, "start_index": int, "end_index": int}

# File citation
{"type": "file_citation", "file_id": str, "filename": str, "index": int, "quote": str}

# Container file citation
{"type": "container_file_citation", "container_id": str, "file_id": str, "file_path": str}

# File path
{"type": "file_path", "file_id": str, "file_path": str}
```

### Message Content Items (for user/system/developer messages)

```python
# Text
{"type": "input_text", "text": str}

# Image
{
    "type": "input_image",
    "detail": "low" | "high" | "auto" | "original",  # required
    "file_id": str | None,      # optional
    "image_url": str | None,    # optional
}

# File
{
    "type": "input_file",
    "detail": "low" | "high",   # optional
    "file_data": str,           # optional (base64)
    "file_id": str | None,      # optional
    "file_url": str,            # optional
    "filename": str,            # optional
}
```

---

## 2. Function Calls

### 2a. `ResponseFunctionToolCallParam` — type: `"function_call"`

```python
{
    "type": "function_call",                                 # required
    "name": str,                                             # required — function name
    "arguments": str,                                        # required — JSON string
    "call_id": str,                                          # required — unique call ID
    "id": str,                                               # optional — item ID
    "namespace": str,                                        # optional
    "status": "in_progress" | "completed" | "incomplete",    # optional
}
```

### 2b. `FunctionCallOutput` — type: `"function_call_output"`

```python
{
    "type": "function_call_output",                          # required
    "call_id": str,                                          # required — matches function_call.call_id
    "output": str | list[OutputItem],                        # required — result
    "id": str | None,                                        # optional
    "status": "in_progress" | "completed" | "incomplete",    # optional
}
```

**OutputItem variants (when output is a list):**

```python
{"type": "input_text", "text": str}
{"type": "input_image", "detail": ..., "file_id": ..., "image_url": ...}
{"type": "input_file", "detail": ..., "file_data": ..., "file_id": ..., "file_url": ..., "filename": ...}
```

---

## 3. Web Search

### `ResponseFunctionWebSearchParam` — type: `"web_search_call"`

```python
{
    "type": "web_search_call",                                         # required
    "id": str,                                                         # required
    "status": "in_progress" | "searching" | "completed" | "failed",    # required
    "action": ActionSearch | ActionOpenPage | ActionFind,               # required
}
```

**Action variants:**

```python
# Search
{
    "type": "search",
    "query": str,                   # required
    "queries": list[str],           # optional
    "sources": list[ActionSearchSource],  # optional (each: url, title, snippet)
}

# Open page
{"type": "open_page", "url": str | None}

# Find in page
{"type": "find_in_page", "pattern": str, "url": str}
```

---

## 4. File Search

### `ResponseFileSearchToolCallParam` — type: `"file_search_call"`

```python
{
    "type": "file_search_call",                                                          # required
    "id": str,                                                                           # required
    "queries": list[str],                                                                # required
    "status": "in_progress" | "searching" | "completed" | "incomplete" | "failed",       # required
    "results": list[Result] | None,                                                      # optional
}
```

**Result:**

```python
{
    "attributes": dict,      # optional
    "file_id": str,          # required
    "filename": str,         # required
    "score": float,          # required
    "text": str,             # required
}
```

---

## 5. Computer Use

### 5a. `ResponseComputerToolCallParam` — type: `"computer_call"`

```python
{
    "type": "computer_call",                                 # required
    "id": str,                                               # required
    "call_id": str,                                          # required
    "status": "in_progress" | "completed" | "incomplete",    # required
    "pending_safety_checks": list[PendingSafetyCheck],       # required
    "action": Action | None,                                 # optional — single action
    "actions": list[Action] | None,                          # optional — batched actions
}
```

**Action variants:** `click`, `double_click`, `drag`, `keypress`, `move`, `screenshot`, `scroll`, `type`, `wait`

### 5b. `ComputerCallOutput` — type: `"computer_call_output"`

```python
{
    "type": "computer_call_output",                          # required
    "call_id": str,                                          # required
    "output": {                                              # required
        "type": "computer_screenshot",
        "file_id": str | None,
        "image_url": str | None,
    },
    "id": str | None,                                        # optional
    "status": "in_progress" | "completed" | "incomplete",    # optional
    "acknowledged_safety_checks": list[...] | None,          # optional
}
```

---

## 6. Shell Calls

### 6a. `LocalShellCall` — type: `"local_shell_call"`

```python
{
    "type": "local_shell_call",                              # required
    "id": str,                                               # required
    "call_id": str,                                          # required
    "status": "in_progress" | "completed" | "incomplete",    # required
    "action": {                                              # required
        "type": "exec",
        "command": list[str],            # required
        "env": dict[str, str],           # required
        "timeout_ms": int | None,        # optional
        "user": str | None,              # optional
        "working_directory": str | None, # optional
    },
}
```

### 6b. `LocalShellCallOutput` — type: `"local_shell_call_output"`

```python
{
    "type": "local_shell_call_output",                       # required
    "id": str,                                               # required
    "output": str,                                           # required — JSON string
    "status": "in_progress" | "completed" | "incomplete",    # optional
}
```

### 6c. `ShellCall` — type: `"shell_call"`

```python
{
    "type": "shell_call",                                    # required
    "call_id": str,                                          # required
    "action": {                                              # required
        "commands": list[str],
        "max_output_length": int | None,
        "timeout_ms": int | None,
    },
    "id": str | None,                                        # optional
    "environment": LocalEnvironment | ContainerReference,    # optional
    "status": "in_progress" | "completed" | "incomplete",    # optional
}
```

### 6d. `ShellCallOutput` — type: `"shell_call_output"`

```python
{
    "type": "shell_call_output",                             # required
    "call_id": str,                                          # required
    "output": list[OutputChunk],                             # required
    "id": str | None,                                        # optional
    "max_output_length": int | None,                         # optional
    "status": "in_progress" | "completed" | "incomplete",    # optional
}
```

**OutputChunk:**

```python
{
    "stdout": str,                   # required
    "stderr": str,                   # required
    "outcome": {                     # required
        "type": "exit", "exit_code": int
    } | {
        "type": "timeout"
    },
}
```

---

## 7. Code Interpreter

### `ResponseCodeInterpreterToolCallParam` — type: `"code_interpreter_call"`

```python
{
    "type": "code_interpreter_call",                                                           # required
    "id": str,                                                                                 # required
    "code": str | None,                                                                        # required
    "container_id": str,                                                                       # required
    "status": "in_progress" | "completed" | "incomplete" | "interpreting" | "failed",          # required
    "outputs": list[OutputLogs | OutputImage] | None,                                          # required
}
```

**Outputs:**

```python
{"type": "logs", "logs": str}
{"type": "image", "url": str}
```

---

## 8. Image Generation

### `ImageGenerationCall` — type: `"image_generation_call"`

```python
{
    "type": "image_generation_call",                                           # required
    "id": str,                                                                 # required
    "result": str | None,                                                      # required — base64 image or null
    "status": "in_progress" | "completed" | "generating" | "failed",          # required
}
```

---

## 9. Apply Patch

### 9a. `ApplyPatchCall` — type: `"apply_patch_call"`

```python
{
    "type": "apply_patch_call",                              # required
    "call_id": str,                                          # required
    "status": "in_progress" | "completed",                   # required
    "operation": CreateFile | DeleteFile | UpdateFile,        # required
    "id": str | None,                                        # optional
}
```

**Operation variants:**

```python
{"type": "create_file", "path": str, "diff": str}
{"type": "delete_file", "path": str}
{"type": "update_file", "path": str, "diff": str}
```

### 9b. `ApplyPatchCallOutput` — type: `"apply_patch_call_output"`

```python
{
    "type": "apply_patch_call_output",                       # required
    "call_id": str,                                          # required
    "status": "completed" | "failed",                        # required
    "id": str | None,                                        # optional
    "output": str | None,                                    # optional — log text
}
```

---

## 10. MCP (Model Context Protocol)

### 10a. `McpListTools` — type: `"mcp_list_tools"`

```python
{
    "type": "mcp_list_tools",                    # required
    "id": str,                                   # required
    "server_label": str,                         # required
    "tools": list[McpTool],                      # required
    "error": str | None,                         # optional
}
```

**McpTool:**

```python
{
    "name": str,                     # required
    "input_schema": object,          # required — JSON Schema
    "description": str | None,       # optional
    "annotations": object | None,    # optional
}
```

### 10b. `McpApprovalRequest` — type: `"mcp_approval_request"`

```python
{
    "type": "mcp_approval_request",              # required
    "id": str,                                   # required
    "name": str,                                 # required — tool name
    "arguments": str,                            # required — JSON string
    "server_label": str,                         # required
}
```

### 10c. `McpApprovalResponse` — type: `"mcp_approval_response"`

```python
{
    "type": "mcp_approval_response",             # required
    "approval_request_id": str,                  # required — matches mcp_approval_request.id
    "approve": bool,                             # required
    "id": str | None,                            # optional
    "reason": str | None,                        # optional
}
```

### 10d. `McpCall` — type: `"mcp_call"`

```python
{
    "type": "mcp_call",                                                                  # required
    "id": str,                                                                           # required
    "name": str,                                                                         # required — tool name
    "arguments": str,                                                                    # required — JSON string
    "server_label": str,                                                                 # required
    "approval_request_id": str | None,                                                   # optional
    "error": str | None,                                                                 # optional
    "output": str | None,                                                                # optional
    "status": "in_progress" | "completed" | "incomplete" | "calling" | "failed",         # optional
}
```

---

## 11. Custom Tools

### 11a. `ResponseCustomToolCallParam` — type: `"custom_tool_call"`

```python
{
    "type": "custom_tool_call",                  # required
    "call_id": str,                              # required
    "name": str,                                 # required — tool name
    "input": str,                                # required — model-generated input
    "id": str,                                   # optional
    "namespace": str,                            # optional
}
```

### 11b. `ResponseCustomToolCallOutputParam` — type: `"custom_tool_call_output"`

```python
{
    "type": "custom_tool_call_output",           # required
    "call_id": str,                              # required
    "output": str | list[OutputItem],            # required
    "id": str,                                   # optional
}
```

---

## 12. Reasoning & Compaction

### 12a. `ResponseReasoningItemParam` — type: `"reasoning"`

Chain-of-thought / thinking item (e.g., o-series models).

```python
{
    "type": "reasoning",                                     # required
    "id": str,                                               # required
    "summary": list[SummaryText],                            # required
    "content": list[ReasoningText] | None,                   # optional
    "encrypted_content": str | None,                         # optional
    "status": "in_progress" | "completed" | "incomplete",    # optional
}
```

**SummaryText:** `{"type": "summary_text", "text": str}`
**ReasoningText:** `{"type": "reasoning_text", "text": str}`

### 12b. `ResponseCompactionItemParamParam` — type: `"compaction"`

Compressed conversation summary.

```python
{
    "type": "compaction",                        # required
    "encrypted_content": str,                    # required — encrypted summary
    "id": str | None,                            # optional
}
```

---

## 13. Tool Search

### 13a. `ToolSearchCall` — type: `"tool_search_call"`

```python
{
    "type": "tool_search_call",                              # required
    "arguments": object,                                     # required
    "id": str | None,                                        # optional
    "call_id": str | None,                                   # optional
    "execution": "server" | "client",                        # optional
    "status": "in_progress" | "completed" | "incomplete",    # optional
}
```

### 13b. `ResponseToolSearchOutputItemParamParam` — type: `"tool_search_output"`

```python
{
    "type": "tool_search_output",                            # required
    "tools": list[ToolParam],                                # required — tool definitions
    "id": str | None,                                        # optional
    "call_id": str | None,                                   # optional
    "execution": "server" | "client",                        # optional
    "status": "in_progress" | "completed" | "incomplete",    # optional
}
```

---

## 14. Item Reference

### `ItemReference` — type: `"item_reference"`

Pointer to another item by ID (used for context windowing).

```python
{
    "type": "item_reference",                    # optional
    "id": str,                                   # required — referenced item ID
}
```

---

## 15. Persistence Pipeline

### How items are saved (`save_result_to_session`)

Located at `agents/run_internal/session_persistence.py`:

1. **Original input** (string) is wrapped: `{"role": "user", "content": "..."}`
2. Each `RunItem` is converted via `model_dump(exclude_unset=True)` to a dict
3. `ToolApprovalItem` is **always skipped** (never persisted)
4. `ToolCallOutputItem` for `shell_call_output` strips `status`, `shell_output`, `provider_data`
5. `ToolSearchCallItem` and `ToolSearchOutputItem` strip `created_by`
6. Items are **deduplicated** by stable identifiers (`id:`, `call_id:`, `approval_request_id:`)
7. `session.add_items(items)` bulk-inserts each item as a row in `agent_messages`

### Database schema

```
agent_sessions
├── session_id    VARCHAR   PK
├── created_at    TIMESTAMP
└── updated_at    TIMESTAMP

agent_messages
├── id            INTEGER   PK AUTOINCREMENT
├── session_id    VARCHAR   FK -> agent_sessions.session_id (CASCADE)
├── message_data  TEXT      JSON-serialized TResponseInputItem
└── created_at    TIMESTAMP
```

Each row in `agent_messages` = one item from the union above.

---

## 16. Conversion Strategy to `useChat`

### Target format (`@deltakit/react`)

```ts
interface Message<TPart> {
  id: string;
  role: "user" | "assistant";
  parts: TPart[];
}

type ContentPart = TextPart | ToolCallPart;
type TextPart = { type: "text"; text: string };
type ToolCallPart = { type: "tool_call"; tool_name: string; argument: string; callId?: string };
```

### Mapping table

| OpenAI `type` | Target `role` | Target `part.type` | Notes |
|---|---|---|---|
| `message` (role=user) | `"user"` | `"text"` | Extract `content` string or join `input_text` items |
| `message` (role=assistant) | `"assistant"` | `"text"` | Extract `output_text` items, join `.text` fields |
| `message` (role=system/developer) | — | — | Skip or treat as metadata |
| `function_call` | `"assistant"` | `"tool_call"` | `tool_name=name`, `argument=arguments`, `callId=call_id` |
| `function_call_output` | — | — | Could extend as `"tool_result"` part |
| `web_search_call` | `"assistant"` | `"tool_call"` | `tool_name="web_search"`, `argument=JSON(action)` |
| `file_search_call` | `"assistant"` | `"tool_call"` | `tool_name="file_search"`, `argument=JSON(queries)` |
| `computer_call` | `"assistant"` | `"tool_call"` | `tool_name="computer"`, `argument=JSON(action)` |
| `shell_call` / `local_shell_call` | `"assistant"` | `"tool_call"` | `tool_name="shell"`, `argument=JSON(action)` |
| `code_interpreter_call` | `"assistant"` | `"tool_call"` | `tool_name="code_interpreter"`, `argument=code` |
| `image_generation_call` | `"assistant"` | extend as `"image"` | New part type needed |
| `apply_patch_call` | `"assistant"` | `"tool_call"` | `tool_name="apply_patch"`, `argument=JSON(operation)` |
| `mcp_call` | `"assistant"` | `"tool_call"` | `tool_name=name`, `argument=arguments` |
| `reasoning` | `"assistant"` | extend as `"reasoning"` | New part type needed |
| `compaction` | — | — | Internal, skip |
| `item_reference` | — | — | Internal, skip |
| `*_output` types | — | extend as `"tool_result"` | New part type needed for outputs |

### Grouping strategy

OpenAI stores items **flat** (one per row). `useChat` groups them into `Message` objects.
Suggested approach:

1. Iterate items in order
2. Consecutive items with the same effective role get merged into one `Message`
3. `message` items start a new `Message`
4. Tool calls/outputs between two `message` items become parts of the preceding assistant `Message`
5. Use the item's `id` for the `Message.id` (first item in group)

### Extended part types for full fidelity

```ts
type ExtendedPart =
  | { type: "text"; text: string }
  | { type: "tool_call"; tool_name: string; argument: string; callId?: string }
  | { type: "tool_result"; tool_name: string; callId: string; output: string }
  | { type: "reasoning"; summary: string; content?: string }
  | { type: "image"; data: string } // base64
  | { type: "refusal"; refusal: string }
  | { type: "annotation"; annotations: Annotation[] };
```
