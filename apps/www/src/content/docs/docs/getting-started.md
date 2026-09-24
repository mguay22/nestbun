---
title: Getting started
description: Install @nestbun/platform and run a NestJS app on Bun.serve() in two minutes.
---

## Requirements

- **Bun 1.4 or newer** (`bun upgrade`).
- **NestJS 12 or newer.**

## Install

```bash
bun add @nestbun/platform @nestjs/common @nestjs/core reflect-metadata rxjs
```

You can remove `@nestjs/platform-express` from an existing project. Nothing else in the app changes.

## Bootstrap

```ts title="src/main.ts"
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { BunAdapter, type NestBunApplication } from '@nestbun/platform';
import { AppModule } from './app.module.js';

const app = await NestFactory.create<NestBunApplication>(AppModule, new BunAdapter());
app.enableCors();
app.enableShutdownHooks();
await app.listen(3000);
```

Run it directly, no build step:

```bash
bun --watch src/main.ts
```

The `NestBunApplication` type adds the platform methods (`useStaticAssets`, `setViewEngine`, `useBodyParser`) to `INestApplication`, the same way `NestExpressApplication` does for Express.

## Start from a template

If you are starting fresh, `@nestbun/create` is `nest new` for Bun. Pass `--adapter bun` to scaffold on `@nestbun/platform` directly:

```bash
bun create @nestbun my-api --adapter bun
cd my-api && bun dev
```

## Troubleshooting

**`TypeError: undefined is not an object (evaluating 'descriptor.value')` on startup.** Bun 1.4 did not find `experimentalDecorators` and compiled TC39 decorators instead. It reads `tsconfig.json` from the directory you run `bun` in, so in a monorepo add one at the root that extends your base config.

## Next steps

- [Migrating from Express](../migrating-from-express/) if you have an existing app.
- [Configuration](../configuration/) for adapter and `Bun.serve()` options.
- [Testing without a port](../testing/) to drop supertest.
