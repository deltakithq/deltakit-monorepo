# @deltakit/markdown

Streaming markdown renderer for AI chat UIs. Parses and renders markdown incrementally so settled blocks usually stay stable and partial syntax never flickers on screen. Zero dependencies beyond React.

## Installation

```bash
npm install @deltakit/markdown
```

Requires React 18+.

## Quick Start

```tsx
import { StreamingMarkdown } from "@deltakit/markdown";

function AssistantMessage({ content }: { content: string }) {
  return <StreamingMarkdown content={content} />;
}
```

For completed/historical messages, use the lighter `Markdown` component:

```tsx
import { Markdown, StreamingMarkdown } from "@deltakit/markdown";

function Message({ content, isStreaming }: { content: string; isStreaming: boolean }) {
  if (isStreaming) {
    return <StreamingMarkdown content={content} />;
  }
  return <Markdown content={content} />;
}
```

With `useStreamChat` from `@deltakit/react`:

```tsx
import { useStreamChat } from "@deltakit/react";
import { Markdown, StreamingMarkdown } from "@deltakit/markdown";

function Chat() {
  const { messages, isLoading, sendMessage } = useStreamChat({
    api: "/api/chat",
  });

  return (
    <div>
      {messages.map((msg) => (
        <div key={msg.id}>
          {msg.parts
            .filter((p) => p.type === "text")
            .map((p, i) => {
              const isActive = isLoading && msg.role === "assistant";
              return isActive ? (
                <StreamingMarkdown key={i} content={p.text} />
              ) : (
                <Markdown key={i} content={p.text} />
              );
            })}
        </div>
      ))}
    </div>
  );
}
```

## API

### `<StreamingMarkdown />`

The main component for rendering actively streaming markdown. Settled blocks are memoized via `React.memo`, so only the active block normally updates unless later parsing extends the same block.

```tsx
<StreamingMarkdown
  content={text}           // Markdown string (grows as tokens arrive)
  batchMs={16}             // Debounce interval in ms (default: 16)
  bufferIncomplete={true}  // Hold back unclosed syntax (default: true)
  className="prose"        // CSS class on wrapper div
  components={{            // Override any rendered element
    code: ({ language, children, inline }) => (
      inline ? <code>{children}</code> : <pre><code>{children}</code></pre>
    ),
  }}
/>
```

### `<Markdown />`

Lightweight component for completed/historical messages. No batching, debouncing, or streaming styles.

```tsx
<Markdown
  content={text}           // Complete markdown string
  className="prose"        // CSS class on wrapper div
  components={{...}}       // Same component overrides as StreamingMarkdown
/>
```

### `useStreamingMarkdown(options)`

Headless hook for full control over rendering.

```tsx
import { useStreamingMarkdown } from "@deltakit/markdown";

function CustomRenderer({ content }: { content: string }) {
  const { nodes, isComplete } = useStreamingMarkdown({
    content,
    batchMs: 16,
    bufferIncomplete: true,
  });

  return <div>{nodes}</div>;
}
```

### `parseIncremental(content, options?)` (framework-agnostic)

The core parser, importable without React:

```ts
import { parseIncremental } from "@deltakit/markdown/core";

const result = parseIncremental("# Hello\n\nSome **bold** text");
// result.blocks   -- array of parsed Block objects
// result.buffered -- incomplete syntax held back from rendering
```

## Supported Syntax

| Syntax | Element |
|--------|---------|
| `# heading` | h1 -- h6 |
| `**bold**` | strong |
| `*italic*` | em |
| `` `code` `` | inline code |
| `~~strike~~` | strikethrough |
| `[text](url)` | link |
| `![alt](src)` | image (with loading skeleton) |
| `https://...` | autolink |
| `` ``` `` fenced blocks | code block |
| `- item` / `* item` | unordered list |
| `1. item` | ordered list |
| `> quote` | blockquote |
| `\| table \|` | table (GFM-style) |
| `---` | horizontal rule |
| blank line | paragraph break |

## Streaming Behavior

- **Settled blocks** normally avoid re-rendering via `React.memo`
- **Active block** re-renders as new characters arrive
- **Code blocks** show as empty `<pre><code>` shells until the closing fence arrives
- **Incomplete syntax** (e.g. unclosed `**`, `[`) is buffered and hidden until resolved
- **Partial list markers** (for example `-`, `1.`, `#`) are buffered until the line is confirmed
- **Table headers and trailing rows** are buffered until the parser has enough complete lines to render them safely
- **batchMs** debounces DOM updates to control render frequency (default: 16ms / ~60fps)

## Performance

- **Singleton style injection** -- one shared `<style>` tag regardless of how many instances are mounted
- **No wrapper DOM nodes** -- blocks render as semantic elements (`<h1>`, `<p>`, `<pre>`) without extra `<div>` or `<span>` wrappers
- **Optimized list rendering** -- simple list items skip full block parsing; nested content uses `resetIds: false` to avoid ID collisions
- **Static `Markdown` component** -- skips all streaming overhead for completed messages

## Bundle Size

12.0 KB minified / 3.8 KB gzipped. Zero runtime dependencies.

## Documentation

Full documentation, guides, and examples at [deltakit.dev](https://deltakit.dev).

## License

MIT
