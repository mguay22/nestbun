# @nestbun/create

`nest new`, but for the Bun runtime.

```bash
bun create @nestbun my-api                 # Express platform, same shape as nest new
bun create @nestbun my-api --adapter bun   # native Bun.serve() via @nestbun/platform
```

Also works as `bunx @nestbun/create my-api` or `npx @nestbun/create my-api`.

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

## How it works

`templates/base` is the project as generated. `--adapter bun` copies `templates/bun-adapter` on top (a `main.ts` and an e2e test that use `BunAdapter`) and swaps `@nestjs/platform-express` for `@nestbun/platform` in `package.json`. Nothing is templated with placeholders, so the base template is a runnable project you can open and edit directly.
