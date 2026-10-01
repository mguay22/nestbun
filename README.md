# nestbun

[![CI](https://github.com/mguay22/nestbun/actions/workflows/ci.yml/badge.svg)](https://github.com/mguay22/nestbun/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@nestbun/platform)](https://www.npmjs.com/package/@nestbun/platform)
[![license](https://img.shields.io/npm/l/@nestbun/platform)](./LICENSE)

Run [NestJS](https://nestjs.com) natively on the [Bun](https://bun.com) runtime: an HTTP adapter built on `Bun.serve()`, with no Express and no `node:http` underneath, plus a project generator.

**[Documentation](https://mguay22.github.io/nestbun/docs/getting-started/)** · [Compatibility](https://mguay22.github.io/nestbun/docs/compatibility/) · [Benchmarks](https://mguay22.github.io/nestbun/docs/benchmarks/) · [Roadmap](https://mguay22.github.io/nestbun/docs/roadmap/)

## Quick start

Requires **Bun ≥ 1.4** (`bun upgrade`) and **NestJS ≥ 12**.

### New project

```bash
bun create @nestbun my-api --adapter bun
cd my-api
bun dev
```

This generates a NestJS 12 project with Zod validation, `bun test`, and no build step. Leave out `--adapter bun` to start on Express instead. All flags are in the [`@nestbun/create` README](./packages/create).

### Existing NestJS project

```bash
bun add @nestbun/platform
```

Pass the adapter to `NestFactory.create()`. This is the only code change:

```ts
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { BunAdapter, type NestBunApplication } from '@nestbun/platform';
import { AppModule } from './app.module.js';

const app = await NestFactory.create<NestBunApplication>(AppModule, new BunAdapter());
await app.listen(3000);
```

```bash
bun src/main.ts
```

Controllers, pipes, guards, interceptors, filters, middleware, SSE, static assets and `@nestjs/swagger` work unchanged. For a larger app, read [Migrating from Express](https://mguay22.github.io/nestbun/docs/migrating-from-express/) and [Differences from Express](https://mguay22.github.io/nestbun/docs/differences-from-express/).

### Configure and test

```ts
new BunAdapter({
  trustProxy: true, // honor X-Forwarded-For / -Proto / -Host
  bodyLimit: '1mb', // default 100kb, same as Express
  serve: { idleTimeout: 120 }, // forwarded to Bun.serve()
});
```

Tests can run requests through the full Nest pipeline in-process, with no port and no supertest:

```ts
const adapter = new BunAdapter();
const app = moduleRef.createNestApplication(adapter);
await app.init();

const res = await adapter.fetch(new Request('http://localhost/users/1'));
expect(res.status).toBe(200);
```

More in [Configuration](https://mguay22.github.io/nestbun/docs/configuration/) and [Testing](https://mguay22.github.io/nestbun/docs/testing/).

## Packages

| Package | What | Status |
|---|---|---|
| [`@nestbun/platform`](./packages/platform) | HTTP adapter running Nest on `Bun.serve()` | ready |
| [`@nestbun/create`](./packages/create) | `nest new`, but on Bun: `bun create @nestbun my-api` | ready |
| `@nestbun/ws` | WebSocket gateway adapter on `Bun.serve({ websocket })` | planned |

## Repo layout

```
packages/platform   the adapter and its integration tests against real Nest apps
packages/create     the generator (@nestbun/create); templates/base is the starter it copies
examples/basic      minimal app: REST + Zod validation + SSE
bench/              same app on express / fastify / bun adapters, one runtime
apps/www            landing page + docs (Astro + Starlight)
```

## Contributing

Pull requests and bug reports are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md), or [open an issue](https://github.com/mguay22/nestbun/issues).

## License

[MIT](./LICENSE)
