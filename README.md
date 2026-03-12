# DeltaKit Monorepo

DeltaKit is a lightweight toolkit for building real-time AI chat interfaces with streaming responses.

This repository contains:
- `@deltakit/core`: Framework-agnostic SSE utilities and shared types
- `@deltakit/react`: React hooks for streaming chat (`useStreamChat`, `useAutoScroll`)
- `@deltakit/markdown`: Incremental, zero-flicker markdown renderer for streaming output
- `apps/docs`: Documentation site
- `examples/fastapi-tanstack-*`: End-to-end frontend + backend example apps

Documentation: [deltakit.dev](https://deltakit.dev)

## Packages

| Package | Purpose | Path | npm |
| --- | --- | --- | --- |
| `@deltakit/core` | SSE parser, message/event types, OpenAI Agents converter | `packages/core` | [@deltakit/core](https://www.npmjs.com/package/@deltakit/core) |
| `@deltakit/react` | Streaming chat hooks and event helpers | `packages/react` | [@deltakit/react](https://www.npmjs.com/package/@deltakit/react) |
| `@deltakit/markdown` | Streaming markdown parser + React renderer | `packages/markdown` | [@deltakit/markdown](https://www.npmjs.com/package/@deltakit/markdown) |

## Prerequisites

- Node.js `>= 22.12.0`
- pnpm `>= 9`
- Python `>= 3.12` (only needed for the FastAPI backend example)
- `uv` (only needed for the FastAPI backend example)

## Install

```bash
pnpm install
```

## Common Workspace Commands

```bash
pnpm check        # Biome checks
pnpm typecheck    # TypeScript checks across projects
pnpm build        # Build workspace projects via Moon
pnpm dev          # Run all dev tasks registered in Moon
```

Run markdown package tests:

```bash
pnpm moon run markdown:test
```

## Run The Docs App

```bash
pnpm --filter @deltakit/docs dev
```

Docs app runs on `http://localhost:3001`.

## Run The Full Example (Frontend + FastAPI Backend)

1. Start the backend:

```bash
cd examples/fastapi-tanstack-api
cp .env.example .env
uv sync
uv run uvicorn src.main:app --reload --port 8000
```

2. In another terminal, start the frontend:

```bash
pnpm --filter @examples/fastapi-tanstack-frontend dev
```

Frontend runs on `http://localhost:3000` and connects to backend `http://localhost:8000`.

## Repository Layout

```text
.
├── apps/
│   └── docs/                           # DeltaKit docs site
├── packages/
│   ├── core/                           # @deltakit/core
│   ├── react/                          # @deltakit/react
│   └── markdown/                       # @deltakit/markdown
├── examples/
│   ├── fastapi-tanstack-frontend/      # Frontend chat app example
│   └── fastapi-tanstack-api/           # FastAPI backend example
└── contributions/
    └── release.md                      # Changesets release workflow
```

## Contributing & Releases

- Create a changeset for user-facing package changes:

```bash
pnpm changeset
```

- Version locally:

```bash
pnpm changeset:version
```

- See full release process: [`contributions/release.md`](./contributions/release.md)

