---
title: Compatibility
description: NestJS Bun compatibility table. Which Nest features and ecosystem packages (swagger, testing, SSE, static files) work on the nestbun adapter.
---

Every ✅ row has an integration test in `packages/platform/test` that boots a real Nest app on the adapter.

## NestJS features

| Feature | Status |
|---|---|
| Routing, params, wildcards, `@All`, HEAD → GET fallback | ✅ |
| `@Body` / `@Query` / `@Param` / `@Headers` / `@Ip` / `@Req` / `@Res` / `@Next` | ✅ |
| JSON + urlencoded parsing, `rawBody`, `bodyParser: false`, `useBodyParser('text' \| 'raw')`, 413 limits | ✅ |
| Exception filters, 404 / 500 shapes identical to Express | ✅ |
| Nest middleware (`MiddlewareConsumer`, `forRoutes`, `exclude`, method-scoped), `app.use()`, `next(err)` | ✅ |
| Global prefix with `exclude`; URI / header / media-type / custom versioning | ✅ |
| CORS (`app.enableCors`) | ✅ |
| `@Redirect`, `@Header`, `@HttpCode`, `res.cookie()` / `clearCookie()`, `setCookie` | ✅ |
| Server-Sent Events with disconnect detection | ✅ |
| `StreamableFile`, manual `res.write()` streaming | ✅ |
| Static assets with ETag / Last-Modified / 304 | ✅ |
| View engines: `ejs`, `hbs`, `pug`, custom `render()` | ✅ |
| `httpsOptions`, `forceCloseConnections`, `return503OnClosing`, graceful shutdown | ✅ |
| Unix socket listen | ✅ |
| Security hooks (`useSecurityHeaders`, `enableCsrfProtection`) | ✅ via `AbstractHttpAdapter` |
| WebSocket gateways | ⏳ planned as `@nestbun/ws` |
| Multipart / `@UploadedFile()` | ⏳ planned |

## Ecosystem packages

| Package | Status |
|---|---|
| `@nestjs/testing` | ✅ `createNestApplication(new BunAdapter())` |
| `@nestjs/swagger` | ✅ UI, JSON, YAML and assets |
| `cors` | ✅ used internally |
| `@nestjs/serve-static` | ⚠️ untested; use `useStaticAssets` |
| `@nestjs/platform-socket.io`, `@nestjs/platform-ws` | ❌ attach to a Node server; wait for `@nestbun/ws` |
| `supertest` | ❌ use `adapter.fetch()` |
| `multer` / `@nestjs/platform-express` interceptors | ❌ Express-only |
| Arbitrary Express middleware | ⚠️ see [Differences from Express](../differences-from-express/) |

Found something missing? [Open an issue](https://github.com/mguay22/nestbun/issues) with a minimal controller.
