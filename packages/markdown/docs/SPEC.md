# @deltakit/markdown — Technical Specification

**Package:** `@deltakit/markdown`
**Version:** 0.1.0
**Part of:** deltakit ecosystem (`deltakit.dev`)
**Status:** Pre-development
**Author:** Indra Zulfi (indrazm)

---

## 1. Problem Statement

`react-markdown` was built for static content. It runs a full pipeline on every render:

```
markdown string → remark (parse) → remark plugins → remark-rehype → rehype plugins → React
```

When used with AI streaming, this pipeline reruns on **every token**, causing:

1. **Full reparse cost** — hundreds of pipeline runs per response
2. **Broken partial markdown** — unclosed `**` renders as plain text, then flickers bold when closed
3. **Layout shifts on code blocks** — ` ```js ` renders as paragraph until the closing ` ``` ` arrives
4. **Heavy bundle** — ~15 transitive dependencies (remark, rehype, unified, micromark, vfile...) for a use case that needs none of their plugin ecosystem

**Goal:** Build a markdown renderer designed from the ground up for AI streaming. Zero flicker. Incremental updates. Tiny bundle.

---

## 2. Package Overview

```
@deltakit/markdown
├── StreamingMarkdown     # Main React component
├── useStreamingMarkdown  # Hook (headless usage)
└── parseIncremental      # Core parser (framework-agnostic)
```

**Tagline:** *"react-markdown, but built for AI streaming. No flicker. No broken syntax."*

---

## 3. API Design

### 3.1 `<StreamingMarkdown />` Component

```tsx
import { StreamingMarkdown } from '@deltakit/markdown'

<StreamingMarkdown
  content={streamingText}          // string — the live streaming markdown content
  components={components}          // optional — override renderers per element type
  batchMs={16}                     // optional — debounce renders (default: 16ms = 60fps)
  bufferIncomplete={true}          // optional — hold back uncertain partial syntax (default: true)
  className="prose"                // optional — className on wrapper div
/>
```

### 3.2 `useStreamingMarkdown` Hook

For headless / bring-your-own-renderer usage:

```tsx
import { useStreamingMarkdown } from '@deltakit/markdown'

const { nodes, isComplete } = useStreamingMarkdown({
  content: streamingText,
  batchMs: 16,
  bufferIncomplete: true,
})

// nodes: ReactNode[] — render however you want
// isComplete: boolean — true when streaming has ended
```

### 3.3 `parseIncremental` (Core, Framework-Agnostic)

```ts
import { parseIncremental } from '@deltakit/markdown/core'

const result = parseIncremental(content, { bufferIncomplete: true })

// result.blocks: Block[] — parsed, safe-to-render blocks
// result.buffered: string — held-back partial content (pending resolution)
```

### 3.4 `components` Prop

Override any element renderer. Same interface as `react-markdown` for easy migration:

```tsx
<StreamingMarkdown
  content={text}
  components={{
    code({ language, children, inline }) {
      if (inline) return <code className="inline-code">{children}</code>
      return <SyntaxHighlighter language={language}>{children}</SyntaxHighlighter>
    },
    a({ href, children }) {
      return <a href={href} target="_blank" rel="noopener">{children}</a>
    }
  }}
/>
```

**Overridable elements:** `p`, `h1`, `h2`, `h3`, `h4`, `h5`, `h6`, `code`, `pre`, `blockquote`, `ul`, `ol`, `li`, `a`, `strong`, `em`, `del`, `hr`, `img`, `table`, `thead`, `tbody`, `tr`, `th`, `td`

---

## 4. Core Rendering Strategy

### 4.1 Block-Level Incremental Rendering

The key insight: **completed blocks never change.** Only the last block is in flux.

```
Stream: "# Hello\n\nThis is a paragraph being streamed tok"

Stable blocks (never rerender):
  [0] <h1>Hello</h1>          ← complete, frozen

Active block (rerenders on each token):
  [1] <p>This is a paragraph being streamed tok</p>
```

Use React `key` props tied to block index so React never touches stable blocks. Only the last block's DOM node updates.

### 4.2 Block Types & Completion Detection

A block is **complete** when its terminator has been received:

| Block Type | Start Signal | Complete When |
|---|---|---|
| Heading | `# `, `## `, etc. | Newline received |
| Paragraph | Any text | Blank line (`\n\n`) received |
| Code block | ` ``` ` | Closing ` ``` ` received |
| Blockquote | `> ` | Blank line received |
| List | `- `, `* `, `1. ` | Blank line received |
| Table | `\|` | Row without `\|` received |
| HR | `---` / `***` | Newline received |

### 4.3 Incomplete Syntax Buffering

When `bufferIncomplete: true` (default), hold back tokens that could change how the current segment renders:

```
Stream arrives:    "Hello **wor"
Buffer:            "**wor"         ← could become bold or plain text
Render:            "Hello "        ← only safe prefix rendered

Next token:        "Hello **world"
Buffer:            "**world"       ← still uncertain
Render:            "Hello "        ← still safe prefix

Next token:        "Hello **world**"
Buffer:            ""              ← resolved! bold confirmed
Render:            "Hello <strong>world</strong>"
```

**Buffering rules:**
- Buffer from last unclosed `**`, `*`, `` ` ``, `~~`, `[`, `![`
- Never buffer more than 200 characters (force-flush if threshold exceeded)
- On stream end (`isComplete = true`), flush buffer and render as-is

### 4.4 Code Block Handling

Code blocks are the most disruptive when mishandled. Special treatment:

```
Stream:   "```js\nconsole.log"
State:    PENDING_CODE_BLOCK
Render:   (render nothing, or a loading code block shell)

Stream:   "```js\nconsole.log('hi')\n```"
State:    CODE_BLOCK_COMPLETE
Render:   <pre><code class="language-js">console.log('hi')</code></pre>
```

When `bufferIncomplete: true`, a pending code block is shown as a skeleton/placeholder rather than as a misrendered paragraph.

### 4.5 Render Batching

Debounce DOM updates to avoid thrashing at high token rates:

```ts
// Default: 16ms batching = max 60fps updates
// batchMs={0} = update on every token (useful for testing)
// batchMs={32} = 30fps, reduces CPU on slow devices
```

Implemented via `useTransition` (React 18+) or `setTimeout` fallback.

---

## 5. Internal Architecture

### 5.1 Parser State Machine

```ts
type ParserState =
  | 'IDLE'
  | 'IN_HEADING'
  | 'IN_PARAGRAPH'
  | 'IN_CODE_BLOCK'           // inside ``` ... ```
  | 'PENDING_CODE_BLOCK'      // saw ``` but no closing yet
  | 'IN_BLOCKQUOTE'
  | 'IN_LIST'
  | 'IN_TABLE'

type Block = {
  id: number            // stable key for React reconciliation
  type: BlockType
  raw: string           // raw markdown source
  complete: boolean     // true = frozen, never rerender
  content: ReactNode    // rendered output
}
```

### 5.2 Inline Renderer

For complete blocks, run a lightweight inline parser (no dependencies):

```
Input:  "Hello **world** and `code` and [link](url)"

Tokens: [
  { type: 'text',   value: 'Hello ' },
  { type: 'strong', value: 'world' },
  { type: 'text',   value: ' and ' },
  { type: 'code',   value: 'code' },
  { type: 'text',   value: ' and ' },
  { type: 'link',   value: 'link', href: 'url' },
]
```

Inline patterns handled (in priority order):
1. `**text**` or `__text__` → `<strong>`
2. `*text*` or `_text_` → `<em>`
3. `` `code` `` → `<code>`
4. `~~text~~` → `<del>`
5. `[text](url)` → `<a>`
6. `![alt](src)` → `<img>`
7. Autolinks: `https://...` → `<a>`

### 5.3 Component Structure

```
<StreamingMarkdown>
  <BlockRenderer key={0} block={blocks[0]} />   ← memo'd, complete, never rerenders
  <BlockRenderer key={1} block={blocks[1]} />   ← memo'd, complete, never rerenders
  <BlockRenderer key={2} block={blocks[2]} />   ← active, rerenders on tokens
  <BufferIndicator buffered={buffered} />        ← renders buffered plain text during uncertainty
</StreamingMarkdown>
```

Every `BlockRenderer` is wrapped in `React.memo` with a custom comparator that returns `true` (skip rerender) when `block.complete === true`.

---

## 6. File Structure

```
packages/markdown/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                  # Public exports
│   ├── component.tsx             # <StreamingMarkdown />
│   ├── hook.ts                   # useStreamingMarkdown
│   ├── core/
│   │   ├── parser.ts             # parseIncremental — state machine
│   │   ├── inline.ts             # Inline markdown renderer
│   │   ├── blocks.ts             # Block type detection & completion logic
│   │   └── types.ts              # Shared types
│   └── renderers/
│       ├── defaults.tsx          # Default element renderers
│       └── index.ts
├── tests/
│   ├── parser.test.ts
│   ├── inline.test.ts
│   ├── streaming.test.tsx        # Simulated token-by-token tests
│   └── flicker.test.tsx          # Regression tests for known flicker cases
└── README.md
```

---

## 7. package.json

```json
{
  "name": "@deltakit/markdown",
  "version": "0.1.0",
  "description": "Streaming markdown renderer for AI chat. No flicker. No broken syntax.",
  "keywords": ["markdown", "streaming", "ai", "react", "sse", "llm"],
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./core": {
      "import": "./dist/core/index.mjs",
      "require": "./dist/core/index.js",
      "types": "./dist/core/index.d.ts"
    }
  },
  "peerDependencies": {
    "react": ">=18.0.0",
    "react-dom": ">=18.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0",
    "tsup": "^8.0.0"
  },
  "sideEffects": false
}
```

**Zero runtime dependencies.** No remark, no rehype, no unified, no micromark.

---

## 8. Test Cases (Required)

The agent must write tests for all of the following scenarios before the package is considered complete.

### 8.1 Flicker Regression Tests

```
CASE 1: Bold word
  Stream: "Hello **" → "Hello **world" → "Hello **world**"
  Assert: DOM never shows "Hello **" or "Hello **world" as plain text

CASE 2: Italic word
  Stream: "This is *" → "This is *important" → "This is *important*"
  Assert: No raw asterisks visible at any point

CASE 3: Code block
  Stream: "```\n" → "```\nconsole" → "```\nconsole.log()\n```"
  Assert: Never renders as <p>, always resolves to <pre><code>

CASE 4: Inline code
  Stream: "Use `cons" → "Use `console" → "Use `console.log()`"
  Assert: Backticks never visible in DOM

CASE 5: Link
  Stream: "[click" → "[click here" → "[click here](https://deltakit.dev)"
  Assert: No raw brackets visible before URL resolves
```

### 8.2 Stable Block Tests

```
CASE: Prior blocks never rerender
  - Stream 3 complete paragraphs + 1 active paragraph
  - Assert: React render count for blocks 0-2 = 1 (initial only)
  - Assert: React render count for block 3 = N (once per token)
```

### 8.3 Compatibility Tests

```
CASE: GFM tables
CASE: Nested lists (2 levels deep)
CASE: Blockquote with inline formatting inside
CASE: Mixed content (heading → paragraph → code block → paragraph)
CASE: Empty content ("")
CASE: Content with only whitespace
CASE: Very long single paragraph (10,000 chars)
CASE: Rapid token bursts (100 tokens in 10ms)
```

---

## 9. Migration from react-markdown

The component prop interface is intentionally compatible:

```tsx
// Before (react-markdown)
import Markdown from 'react-markdown'
<Markdown components={components}>{content}</Markdown>

// After (@deltakit/markdown)
import { StreamingMarkdown } from '@deltakit/markdown'
<StreamingMarkdown components={components} content={content} />
```

Main differences:
- `children` → `content` prop (explicit, not JSX children)
- No `remarkPlugins` / `rehypePlugins` (by design — no plugin system)
- No `rehypeRaw` support (no `dangerouslySetInnerHTML` path)
- Adds `batchMs` and `bufferIncomplete` props

---

## 10. Non-Goals

The following are explicitly out of scope for v0.1.0:

- Plugin system (remark/rehype compatible)
- Math / KaTeX support
- MDX / JSX in markdown
- HTML passthrough (`dangerouslySetInnerHTML`)
- Server-side rendering (SSR) — planned for v0.2.0
- Vue / Solid adapters — use `parseIncremental` from `@deltakit/markdown/core`

---

## 11. Success Metrics

| Metric | Target |
|---|---|
| Bundle size (minzipped) | < 8kb |
| Runtime dependencies | 0 |
| Rerender count per stable block | 1 |
| Time to first visible content | < 50ms from first token |
| Flicker regression tests | 0 failures |
| TypeScript coverage | 100% public API typed |

---

## 12. Integration with @deltakit/react

Once stable, `@deltakit/react` will re-export a `markdown` option:

```tsx
const { messages, sendMessage } = useStreamChat({ api: '/api/chat' })

// messages[n].parts[0].text is the streaming string
// Pass directly to StreamingMarkdown
<StreamingMarkdown content={messages[messages.length - 1].parts[0].text} />
```

---

*Built by deltakithq · deltakit.dev · @deltakit/markdown*