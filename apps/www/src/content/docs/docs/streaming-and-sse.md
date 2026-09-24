---
title: Streaming and SSE
description: Server-Sent Events, StreamableFile and manual streaming on the Bun adapter.
---

All three of Nest's streaming mechanisms work unchanged because the response object implements the `node:stream` Writable interface (Bun's native implementation of it) and turns into a Web `ReadableStream` the moment something writes to it.

## Server-Sent Events

```ts
@Sse('events')
events(): Observable<MessageEvent> {
  return interval(1000).pipe(map((i) => ({ data: { tick: i } })));
}
```

```bash
curl -N http://localhost:3000/events
```

Nest commits the SSE headers (`Content-Type: text/event-stream`, `Cache-Control: no-cache`) and writes each message. When the client disconnects, the adapter aborts the request-scoped signal and Nest unsubscribes from the observable, so producers stop.

## StreamableFile

```ts
@Get('report')
report() {
  return new StreamableFile(createReadStream('report.pdf'), {
    type: 'application/pdf',
    disposition: 'attachment; filename="report.pdf"',
  });
}
```

Nest pipes the Node stream into the response; the adapter forwards each chunk to the client as it arrives.

## Manual streaming with `@Res()`

```ts
@Get('log')
log(@Res() res: BunResponse) {
  res.setHeader('content-type', 'text/plain');
  res.write('starting\n');
  setTimeout(() => res.end('done\n'), 1000);
}
```

The first `write()` (or `writeHead()` / `flushHeaders()`) commits the status and headers. After that, headers cannot change.

## Sending a file with zero copies

For whole files, skip the stream and hand Bun the file:

```ts
res.sendBunFile(Bun.file('./big.mp4'));
```

`Content-Type` and `Content-Length` are set from the file and Bun uses `sendfile` under the hood. `res.sendFile(absolutePath)` is the Express-compatible spelling.

## Idle connections

Long-lived streams that send nothing for longer than `serve.idleTimeout` (default 120 seconds) are closed by Bun. Send a heartbeat comment from SSE handlers that can go quiet, or raise the timeout up to Bun's maximum of 255 seconds.
