---
title: Getting started
description: Install @nestbun/platform and run a NestJS app on Bun.serve() in two minutes.
---

## Requirements

- **Bun 1.4 or newer** (`bun upgrade`).
- **NestJS 12 or newer.**
- A `tsconfig.json` with `experimentalDecorators` and `emitDecoratorMetadata`. Every Nest project already has these; Bun reads them to compile Nest's decorators. Bun resolves the tsconfig from the directory you run `bun` in, so a monorepo needs one at its root too.

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

## Validation with Zod

NestJS 12 validates any [Standard Schema](https://standardschema.dev) natively, so Zod works without `class-validator` or `nestjs-zod`:

```ts
import { StandardSchemaValidationPipe } from '@nestjs/common';
app.useGlobalPipes(new StandardSchemaValidationPipe());
```

```ts
@Post()
create(@Body({ schema: createCat }) dto: z.infer<typeof createCat>) {
  return this.cats.create(dto);
}
```

## Start from a template

If you are starting fresh, the `nest-bun` template is `nest new` for Bun:

```bash
bun create mguay22/nest-bun my-api
cd my-api && bun dev
```

## Next steps

- [Migrating from Express](../migrating-from-express/) if you have an existing app.
- [Configuration](../configuration/) for adapter and `Bun.serve()` options.
- [Testing without a port](../testing/) to drop supertest.
