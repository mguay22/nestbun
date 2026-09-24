# create-nest-bun

`nest new`, but for the Bun runtime.

```bash
bun create nest-bun my-api                 # Express platform, same shape as nest new
bun create nest-bun my-api --adapter bun   # native Bun.serve() via @nestbun/platform
```

Also works as `bunx create-nest-bun my-api` or `npx create-nest-bun my-api`.

## What you get

- NestJS 12, native ESM, no build step (`bun --watch src/main.ts`)
- Zod validation through NestJS 12's `StandardSchemaValidationPipe` (no `class-validator`)
- `bun test` with a unit spec and an e2e spec
- TypeScript 7 for type-checking, oxlint, Prettier
- `bun run g resource users` proxies to the Nest CLI schematics, and the output type-checks as-is

With `--adapter bun`, `src/main.ts` boots on `BunAdapter` from [`@nestbun/platform`](https://mguay22.github.io/nestbun/): no Express, no `node:http`, and the e2e test runs against `Bun.serve()`.

## Options

| Flag | Default | |
|---|---|---|
| `--adapter <express\|bun>` | prompt, or `express` with `-y` | HTTP platform |
| `--name <pkg>` | directory name | `package.json` name |
| `--no-install` | | skip `bun install` |
| `--no-git` | | skip `git init` |
| `-y`, `--yes` | | accept defaults, never prompt |
| `-f`, `--force` | | overwrite a non-empty directory |

## Same template, two doors

`bun create mguay22/nest-bun my-api` clones the [template repo](https://github.com/mguay22/nest-bun) directly (Express, no options). That repo is synced from this package's `templates/base`, so both produce the same project.
