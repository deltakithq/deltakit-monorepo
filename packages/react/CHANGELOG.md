# @deltakit/react

## 0.2.2

### Patch Changes

- 8f66b1a: Improve `useAutoScroll` stability during streaming by keeping pinned updates frame-synced and non-animated, while preserving configured scroll behavior for explicit `scrollToBottom()` jumps. Add package tests and document the updated smooth-scrolling behavior.

## 0.2.1

### Patch Changes

- 3ddc9be: docs: add stop/cancel support documentation for websocket and background-sse transports

## 0.2.0

### Minor Changes

- Add fromAgnoAgents converter for Agno agent framework support

### Patch Changes

- Updated dependencies
  - @deltakit/core@0.2.0

## 0.1.4

### Patch Changes

- Update package descriptions and add homepage URL

  - @deltakit/core: "Build AI chat backends with SSE streaming and type-safe message handling"
  - @deltakit/react: "React hooks for streaming AI conversations with real-time updates"
  - @deltakit/markdown: "Stream markdown in AI chat without flicker or broken syntax"

  All packages now include homepage: https://deltakit.dev

- Updated dependencies
  - @deltakit/core@0.1.3

## 0.1.3

### Patch Changes

- d36fd1d: Fix CI/CD pipeline and moon task configuration
- Updated dependencies [d36fd1d]
  - @deltakit/core@0.1.2
