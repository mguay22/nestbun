---
title: How it works
description: The adapter contract, the request/response shims, the router, and the streaming path.
---

Nest talks to its HTTP platform through the `HttpServer` interface, implemented by `AbstractHttpAdapter`. The Express and Fastify adapters implement it on top of Node's `http` module. `BunAdapter` implements it on top of `Bun.serve()`. There is no `node:http` anywhere in the request path.

## One request, end to end

1. `Bun.serve` calls the adapter's `fetch(request, server)` with a Web `Request`.
2. The adapter wraps it in a `BunRequest` and creates a `BunResponse`.
3. The `Router` walks its layer stack in registration order: hooks, body parsers, CORS, Nest middleware, then the route handlers Nest registered, then Nest's not-found and error handlers.
4. The matched Nest handler runs guards, pipes, interceptors and the controller method, then calls `adapter.reply(res, body)`.
5. `reply` ends the response. `BunResponse` resolves its `Promise<Response>`, and `Bun.serve` sends it.

## `BunRequest`

Express-shaped: `method`, `url`, `path`, `query`, `params`, `headers`, `body`, `ip`, `hostname`, `protocol`, `get()`, `is()`. It extends the `node:stream` `Readable` so stream-based middleware can consume the body. Everything not needed on the hot path is a lazy getter (`headers`, `query`, `socket`, `ip`), and the abort listener is only attached when something asks for disconnect events. That laziness is worth about 1.3µs per request, which is most of the gap to raw `Bun.serve`.

The Web `Request` is `req.native`.

## `BunResponse`

Implements the `node:stream` Writable interface (Bun's native implementation; no Node runtime involved) and resolves into a Web `Response`. Two paths:

- **Buffered.** `end(body)` with no prior `write()` collects the body and builds one fixed-length `Response`. This is every normal JSON reply.
- **Streaming.** The first `write()`, `writeHead()` or `flushHeaders()` commits status and headers and hands Bun a `ReadableStream`; later writes are enqueued. Nest's SSE stream and `StreamableFile` call `stream.pipe(response)`, which is why the response must speak the Writable interface at all.

On top sits the Express surface: `status`, `set`, `json`, `send`, `redirect`, `cookie`, `sendFile`, `sendBunFile`, `render`.

## `Router`

An Express-style layer stack on `path-to-regexp` v8, the same route syntax Express 5 and Nest use. `use()` mounts prefix-matched middleware, verb methods register exact-match routes, first match wins, `next()` advances, `next(err)` jumps to the next 4-arity handler. HEAD requests fall back to GET routes.

## Lifecycle

`getHttpServer()` returns a `BunHttpServer`, an `EventEmitter` that looks enough like a Node `net.Server` for Nest's `listen()` and `getUrl()`: `listen`, `close`, `address()`, `'error'` and `'listening'` events. Graceful `close()` waits for `server.pendingRequests` to drain (up to `shutdownTimeout`) and then stops the server, dropping idle keep-alive connections, because Bun's `stop(false)` cannot be followed by `stop(true)`.

## Two Bun details that mattered

- `request.body.getReader()` is much slower than `request.arrayBuffer()`. The body parsers use the fast path whenever `Content-Length` is present and stream only for chunked bodies.
- Bun 1.4 compiles TC39 decorators unless it finds `experimentalDecorators` in a tsconfig resolved from the working directory. Keep one at your repo root.
