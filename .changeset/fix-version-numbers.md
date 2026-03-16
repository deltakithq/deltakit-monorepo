---
"@deltakit/markdown": patch
---

fix(markdown): prevent version numbers from being parsed as ordered list items

- Add negative lookahead (?![\d.]) to ordered list regex
- Fixes corruption of version numbers (e.g., v25.0, 11.8.0) during streaming
- Also handles IP addresses (192.168.1.1) and decimal numbers (3.14)
- Bump version to 0.1.7
