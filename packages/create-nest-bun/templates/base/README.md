# nest-bun

A [NestJS](https://nestjs.com) starter that runs on the [Bun](https://bun.com) runtime. Same shape as `nest new`, but no build step: Bun executes TypeScript directly.

## Create a project

Requires Bun ≥ 1.4 (`bun upgrade`).

```bash
bun create nest-bun my-api                 # Express, same shape as nest new
bun create nest-bun my-api --adapter bun   # native Bun.serve() via @nestbun/platform
cd my-api
bun dev
```

## What's inside

- **NestJS 12** — native ESM, Zod validation via `@Body({ schema })` and the global `StandardSchemaValidationPipe` (no `class-validator`)
- **Bun runtime** — `bun --watch src/main.ts` for dev, `bun test` for unit and e2e tests
- **TypeScript 7** for type-checking only (`bun run typecheck`)
- **oxlint** + **Prettier**

```
src/
  main.ts              bootstrap
  app.module.ts
  app.controller.ts    GET /  and  POST /greet (Zod-validated)
  app.schemas.ts       Zod request schemas + inferred types
  app.service.ts
  app.controller.test.ts
test/
  app.e2e.test.ts      boots the app on a random port and hits it with fetch
```

## Scripts

| Command | What it does |
|---|---|
| `bun dev` | Start with file watching |
| `bun start` | Start once |
| `bun test` | Run all `*.test.ts` files |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` | oxlint |
| `bun run g resource users` | Nest CLI schematics via `bunx` |

## Conventions

- ESM everywhere: `"type": "module"`, `NodeNext` resolution, and `.js` extensions on relative imports (`./app.module.js`).
- Request validation lives in `*.schemas.ts` files as Zod schemas. Infer DTO types from them instead of writing classes.
- Controllers stay thin: bind routes, validate, delegate to a service.

## Using the Nest CLI

`bun run g resource users` scaffolds a module, controller, service, DTOs and specs, exactly like the Nest CLI does in a Node project. It works out of the box here:

- Generated `*.spec.ts` files run under `bun test` as-is. `describe`, `it` and `expect` are globals at runtime, and `bun-types/test-globals` (already in `tsconfig.json`) types them.
- `@nestjs/mapped-types` is pre-installed so the generated `UpdateXDto extends PartialType(...)` compiles.

The one thing worth changing: the generated DTOs are empty classes meant for `class-validator`. Replace them with a Zod schema in `users.schemas.ts` and validate with `@Body({ schema })`, as `app.controller.ts` does.
