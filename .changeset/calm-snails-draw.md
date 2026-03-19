---
"@deltakit/markdown": patch
---

Fix streaming table detection so partial pipe rows stay buffered until a valid
table separator arrives, preventing malformed table layouts during live
rendering.
