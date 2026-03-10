# @deltakit/markdown

Streaming markdown renderer for AI chat UIs. Parses and renders markdown incrementally so completed blocks never re-render and partial syntax never flickers on screen. Zero dependencies beyond React.

## Installation

```bash
npm install @deltakit/markdown
```

Requires React 18+.

## Quick Start

```tsx
import { StreamingMarkdown } from "@deltakit/markdown";

function AssistantMessage({ content }: { content: string }) {
  return <StreamingMarkdown content={content} isStreaming={true} />;
}
```

With `useStreamChat` from `@deltakit/react`:

```tsx
import { useStreamChat } from "@deltakit/react";
import { StreamingMarkdown } from "@deltakit/markdown";

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
            .map((p, i) => (
              <StreamingMarkdown
                key={i}
                content={p.text}
                isStreaming={isLoading}
              />
            ))}
        </div>
      ))}
    </div>
  );
}
```

## API

### `<StreamingMarkdown />`

The main component. Pass markdown text and a streaming flag.

```tsx
<StreamingMarkdown
  content={text}           // Markdown string
  isStreaming={true}        // true while content is arriving
  batchMs={8}              // Debounce interval in ms (default: 0)
  components={{            // Override any rendered element
    h1: ({ children }) => <h1 className="title">{children}</h1>,
    code_block: ({ language, code }) => (
      <SyntaxHighlighter language={language}>{code}</SyntaxHighlighter>
    ),
  }}
/>
```

Completed blocks are memoized with `React.memo` -- they never re-render as new content streams in.

### `useStreamingMarkdown(options)`

The underlying hook, for full control over rendering.

```tsx
import { useStreamingMarkdown } from "@deltakit/markdown";

function CustomRenderer({ content, isStreaming }) {
  const { blocks, buffered } = useStreamingMarkdown({
    content,
    isStreaming,
    batchMs: 8,
  });

  return (
    <div>
      {blocks.map((block, i) => (
        <BlockRenderer key={i} block={block} />
      ))}
    </div>
  );
}
```

### `parseIncremental(content)` (framework-agnostic)

The core parser, importable without React:

```ts
import { parseIncremental } from "@deltakit/markdown/core";

const result = parseIncremental("# Hello\n\nSome **bold** text");
// result.blocks  -- completed blocks
// result.active  -- block still being typed
// result.buffer  -- incomplete syntax held back
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
| `![alt](src)` | image |
| `<url>` | autolink |
| `` ``` `` fenced blocks | code block |
| `- item` / `* item` | unordered list |
| `1. item` | ordered list |
| `> quote` | blockquote |
| `---` | horizontal rule |
| blank line | paragraph break |

## Streaming Behavior

- **Completed blocks** render immediately and are memoized
- **Active block** re-renders as new characters arrive
- **Code blocks** show as empty skeleton `<pre><code>` shells until the closing fence arrives
- **Incomplete syntax** (e.g. unclosed `**`) is buffered and hidden until resolved
- **batchMs** debounces updates to reduce render frequency during fast streams

## Bundle Size

12.0 KB minified / 3.8 KB gzipped. Zero runtime dependencies.

## Documentation

Full documentation, guides, and examples at [deltakit.dev](https://deltakit.dev).

## License

MIT
