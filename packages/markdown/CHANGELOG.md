# @deltakit/markdown

## 0.1.5

### Patch Changes

- Improve markdown image streaming behavior by buffering incomplete image syntax and deferring image rendering until each image is loaded.

  Incomplete image markers like `![alt](src` now stay hidden during streaming to prevent raw markdown flicker. Parsed images render a reserved skeleton first, then swap to the final image when ready, and show an accessible fallback with alt text if loading fails.

## 0.1.4

### Patch Changes

- d36fd1d: Fix CI/CD pipeline and moon task configuration
