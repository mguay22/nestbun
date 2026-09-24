---
title: Roadmap
description: What is planned for nestbun after the HTTP adapter.
---

## Next

- **`@nestbun/ws`**: a WebSocket gateway adapter on `Bun.serve({ websocket })`, sharing the HTTP port, with Bun's native pub/sub for rooms. Nest's built-in `ws` and Socket.IO adapters attach to a Node server, so this has to be a separate package.
- **Multipart uploads**: `@UploadedFile()` / `@UploadedFiles()` backed by `Request.formData()`, with size and count limits.

## Later

- Make `--adapter bun` the default in `@nestbun/create` once `@nestbun/ws` and multipart land.
- Backpressure on the streaming path (respect `ReadableStream` `desiredSize`).
- `@nestjs/serve-static` and `@nestjs/graphql` compatibility passes.
- HTTP/2 when `Bun.serve` exposes it.

## Not planned

- Running on Node. The adapter is Bun-native on purpose.
- Full Express middleware emulation. Anything beyond the documented compatible subset is out of scope.

Track progress and vote on items in [GitHub issues](https://github.com/mguay22/nestbun/issues).
