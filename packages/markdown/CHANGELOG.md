# @deltakit/markdown

## 0.1.8

### Patch Changes

- 556563a: fix(markdown): prevent version numbers from being parsed as ordered list items

  - Add negative lookahead (?![\d.]) to ordered list regex
  - Fixes corruption of version numbers (e.g., v25.0, 11.8.0) during streaming
  - Also handles IP addresses (192.168.1.1) and decimal numbers (3.14)
  - Bump version to 0.1.7

## 0.1.6

### Patch Changes

- Update package descriptions and add homepage URL

  - @deltakit/core: "Build AI chat backends with SSE streaming and type-safe message handling"
  - @deltakit/react: "React hooks for streaming AI conversations with real-time updates"
  - @deltakit/markdown: "Stream markdown in AI chat without flicker or broken syntax"

  All packages now include homepage: https://deltakit.dev

## 0.1.5

### Patch Changes

- Improve markdown image streaming behavior by buffering incomplete image syntax and deferring image rendering until each image is loaded.

  Incomplete image markers like `![alt](src` now stay hidden during streaming to prevent raw markdown flicker. Parsed images render a reserved skeleton first, then swap to the final image when ready, and show an accessible fallback with alt text if loading fails.

## 0.1.4

### Patch Changes

- d36fd1d: Fix CI/CD pipeline and moon task configuration
