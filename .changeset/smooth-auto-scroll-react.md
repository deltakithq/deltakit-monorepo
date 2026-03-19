---
"@deltakit/react": patch
---

Improve `useAutoScroll` stability during streaming by keeping pinned updates frame-synced and non-animated, while preserving configured scroll behavior for explicit `scrollToBottom()` jumps. Add package tests and document the updated smooth-scrolling behavior.
