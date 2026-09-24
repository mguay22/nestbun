---
title: Getting started
description: Run NestJS on Bun in two minutes. Start a new project with @nestbun/create, or add the @nestbun/platform adapter to an existing Nest app with one line changed.
---

Requires **Bun 1.4 or newer** (`bun upgrade`) and **NestJS 12 or newer**.

## Start a new project

```bash
bun create @nestbun my-api --adapter bun
cd my-api
bun dev
```

That gives you a NestJS 12 app already running on `Bun.serve()`: native ESM, no build step, `bun test` with a unit and an e2e spec, TypeScript for type-checking. Leave off `--adapter bun` to get the Express platform instead, the same shape as `nest new`.

## Add it to an existing project

Install the adapter and drop the Express platform:

```bash
bun add @nestbun/platform
bun remove @nestjs/platform-express @types/express
```

Then pass it to `NestFactory.create()`. This is the only code change:

```ts title="src/main.ts"
import { NestFactory } from '@nestjs/core';
import { BunAdapter, type NestBunApplication } from '@nestbun/platform';
import { AppModule } from './app.module.js';

const app = await NestFactory.create<NestBunApplication>(AppModule, new BunAdapter());
await app.listen(3000);
```

Run it directly, no `nest build`:

```bash
bun --watch src/main.ts
```

The `NestBunApplication` type adds the platform methods (`useStaticAssets`, `setViewEngine`, `useBodyParser`) to `INestApplication`, the same way `NestExpressApplication` does for Express. See [Migrating from Express](../migrating-from-express/) for the handful of things worth checking in a larger app.

## Troubleshooting

**`TypeError: undefined is not an object (evaluating 'descriptor.value')` on startup.** Bun 1.4 did not find `experimentalDecorators` and compiled TC39 decorators instead. It reads `tsconfig.json` from the directory you run `bun` in, so in a monorepo add one at the root that extends your base config.

## Next steps

- [Configuration](../configuration/) for adapter and `Bun.serve()` options.
- [Testing without a port](../testing/) to drop supertest.
- [Compatibility](../compatibility/) for what works and what is planned.
