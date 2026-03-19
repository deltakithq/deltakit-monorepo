# @deltakit/markdown

## 0.2.4

### Patch Changes

- fdbb58d: Fix streaming fenced code blocks so their content renders progressively before the closing fence arrives.

## 0.2.3

### Patch Changes

- 37cb40a: Fix streaming table detection so partial pipe rows stay buffered until a valid
  table separator arrives, preventing malformed table layouts during live
  rendering.

## 0.2.2

### Patch Changes

- 7d59084: fix(markdown): prevent intraword underscores from triggering emphasis (e.g. `get_skill_users()` no longer renders as italic)

## 0.2.1

### Patch Changes

- fix(markdown): prevent intraword underscores from triggering emphasis (e.g. `get_skill_users()` no longer renders as italic)

## 0.2.0

### Minor Changes

- ## 0.2.0 - Comprehensive Markdown Parser Improvements

  ### New Features

  - **Lazy blockquote continuation**: Lines without `>` can now continue blockquote paragraphs (CommonMark compliant)
  - **Mixed list type detection**: Ordered and unordered lists now properly split when list type changes
  - **Multi-paragraph list items**: Indented content after blank lines within lists is now preserved
  - **4+ backtick fence support**: Code blocks with 4+ backticks now properly handle nested 3-backtick content

  ### Bug Fixes

  - Fixed code block language extraction to only extract the first word (e.g., `typescript` from `typescript highlight=1`)
  - Fixed regex bundling issue that caused code block languages to be undefined in production builds
  - Fixed XSS vulnerabilities in link href and image src attributes (blocks javascript: protocol)
  - Fixed version number parsing to prevent corruption during streaming (e.g., v25.0, 11.8.0)

  ### Testing

  - Added 94 comprehensive parsing tests covering edge cases, unicode, special characters, and complex documents
  - Added XSS prevention tests for link href sanitization and image src sanitization
  - Total test coverage: 228 tests (all passing)

  ### Performance

  - Benchmarks show 5x faster rendering than react-markdown
  - 190x faster parsing than micromark
  - Bundle size remains 9x smaller (3.8kb gzipped)

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
