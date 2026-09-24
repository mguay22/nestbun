---
title: Migrating from Express
description: Move an existing NestJS application from @nestjs/platform-express to the Bun adapter.
---

Most apps migrate by changing one import. This page lists what to check.

## 1. Swap the adapter

```diff
- import { NestExpressApplication } from '@nestjs/platform-express';
+ import { BunAdapter, type NestBunApplication } from '@nestbun/platform';

- const app = await NestFactory.create<NestExpressApplication>(AppModule);
+ const app = await NestFactory.create<NestBunApplication>(AppModule, new BunAdapter());
```

```bash
bun remove @nestjs/platform-express @types/express
bun add @nestbun/platform
```

## 2. Replace the run scripts

```json title="package.json"
{
  "scripts": {
    "dev": "bun --watch src/main.ts",
    "start": "bun src/main.ts",
    "test": "bun test"
  }
}
```

`nest build` and `dist/` are no longer needed. Keep `tsc --noEmit` as a type-check step if you like.

## 3. Check your `@Res()` handlers

`res` is a `BunResponse`. It has the Express surface you already use: `status()`, `set()`, `json()`, `send()`, `redirect()`, `cookie()`, `sendFile()`, `write()`, `end()`, plus the Node `ServerResponse` methods (`setHeader`, `writeHead`, `flushHeaders`).

Type it explicitly if you were importing `Response` from Express:

```ts
import type { BunResponse } from '@nestbun/platform';

@Get('download')
download(@Res() res: BunResponse) {
  res.set('Content-Disposition', 'attachment; filename="report.csv"');
  res.send(csv);
}
```

## 4. Check third-party Express middleware

Middleware that only reads `req.headers`, `req.body`, `req.query`, `req.method` and writes through `res.setHeader`, `res.status`, `res.end` or `res.json` works as-is. That covers `cors`, most loggers, and most auth checks.

Middleware that mounts Express sub-routers, rewrites `req.url`, or reaches into `IncomingMessage` internals does not. Common cases and their replacements:

| Express middleware | On the Bun adapter |
|---|---|
| `express.static` | `app.useStaticAssets(dir, options)` |
| `express.json()` / `urlencoded()` | registered by default; `app.useBodyParser('text')` for more |
| `cookie-parser` | read `req.headers.cookie`, or use Bun's `Bun.CookieMap` |
| `multer` | multipart is on the [roadmap](../roadmap/); use `req.native.formData()` meanwhile |
| `helmet` | Nest 12's `app.useSecurityHeaders()` |

## 5. Tests

supertest needs a Node `http.Server`. Use the in-process `adapter.fetch()` instead, see [Testing without a port](../testing/).

## 6. Things that behave slightly differently

See [Differences from Express](../differences-from-express/). The short list: simple query-string parsing, `Buffer` return values sent as bytes, and route order that is first-match like Express.
