---
title: Differences from Express
description: The handful of behaviors that differ from @nestjs/platform-express, and why.
---

The adapter matches Express wherever a test might notice: default content types, `404` and `500` body shapes, `charset` handling, route order. These are the intentional exceptions.

## Query strings use the simple parser

`?tag=a&tag=b` → `{ tag: ['a', 'b'] }`. Nested syntax like `?filter[name]=x` stays as a literal key. This is what Express 5 does by default too, but the Nest Express adapter turns on the extended `qs` parser. If you need nesting, parse `req.query` with `qs` in a pipe.

## `Buffer` return values are sent as bytes

```ts
@Get('png')
png() { return Buffer.from(...); }
```

sends `application/octet-stream` bytes. Express JSON-encodes a Buffer as `{"type":"Buffer","data":[...]}`, which nobody wants.

## Route order is first-match

Exactly like Express, and unlike Fastify. A `@Get(':id')` declared above `@Get('live')` shadows it. Declare parameterized routes after their static siblings, or use Nest's `specificity` route resolution.

## `charset` is added by Nest and `res.set()`, not by `res.setHeader()`

`@Header('Content-Type', 'text/plain')` and `res.set('Content-Type', 'text/plain')` produce `text/plain; charset=utf-8`. The Node-level `res.setHeader()` writes the value verbatim. This mirrors Express, where `res.set` normalizes and `setHeader` does not.

## `413` and `415` are mapped to Nest exceptions

Body-limit and charset failures surface as `PayloadTooLargeException` and `UnsupportedMediaTypeException`, so your exception filters see them. Express leaves them as generic errors.

## `req.raw` does not exist

Nest reads `req.raw` as a Node `IncomingMessage` for SSE. The Web `Request` is exposed as `req.native` instead.

## No supertest

It needs a Node `http.Server`. Use [`adapter.fetch()`](../testing/).

## Express middleware compatibility

Works: anything that reads `req.headers`, `req.body`, `req.query`, `req.method`, `req.url` and writes with `res.setHeader`, `res.status`, `res.end`, `res.json`, `res.send`. Does not work: mounting sub-routers, rewriting `req.url` / `req.baseUrl`, or reaching into `IncomingMessage` internals. See the [migration guide](../migrating-from-express/) for replacements.
