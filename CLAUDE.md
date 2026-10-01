# nestbun

NestJS on the Bun runtime. A Bun workspace monorepo that publishes two npm packages:

- `@nestbun/platform` (`packages/platform`): a NestJS HTTP adapter built on `Bun.serve()`, with no Express and no `node:http`.
- `@nestbun/create` (`packages/create`): the project generator behind `bun create @nestbun my-api`.

Docs site: https://mguay22.github.io/nestbun/ (source in `apps/www`).

## Commands

Run from the repo root. Requires Bun ≥ 1.4. Use `bun`, never `npm`/`yarn`/`pnpm`.

```bash
bun install            # also installs the git hooks
bun run build          # platform + create + docs site
bun run lint           # oxlint; warnings fail
bun run format         # prettier --write (format:check to verify)
bun run typecheck      # platform, create, examples/basic
bun run test           # platform + create test suites
bun test packages/platform/test/routing.test.ts   # one file
bun test -t "name"                                # one test by name
```

Run `bun run build` before `bun run typecheck`: `examples/basic` type-checks against the adapter's emitted declarations in `packages/platform/dist`.

CI (`.github/workflows/ci.yml`) runs build, lint, format:check, typecheck, test, then boots `examples/basic`, on ubuntu + macOS × Bun `latest` + `canary`. Run the same sequence before saying a change is done.

Other:

```bash
cd examples/basic && bun dev              # http://localhost:3000/cats
bun run --filter '@nestbun/www' dev       # docs site
bun run --filter '@nestbun/bench' bench   # ~1 minute benchmark, prints a markdown table
bun run release patch --dry-run           # preview a release
```

## Layout

```
packages/platform/src    the adapter
packages/platform/test   integration tests against real Nest apps
packages/create/src      generator CLI (index.ts) and scaffolding logic (scaffold.ts)
packages/create/templates/base          the generated project, runnable as-is
packages/create/templates/bun-adapter   files copied on top for --adapter bun
examples/basic           minimal app: REST + Zod validation + SSE
bench/                   same app on express / fastify / bun adapters
apps/www                 Astro + Starlight; docs pages in src/content/docs/docs/
scripts/                 publish.ts (used by release.yml), release.ts (bun run release)
```

## How the adapter works

`BunAdapter` (`adapter.ts`) extends Nest's `AbstractHttpAdapter`. For each `Bun.serve` request:

- `request.ts`: `BunRequest`, a Node `Readable` with Express-shaped fields (`query`, `headers`, `ip`, ...) computed lazily.
- `response.ts`: `BunResponse`, a Node `Writable` that resolves into a Web `Response`. `end()` with no prior `write()` takes a buffered fast path; anything else becomes a `ReadableStream`. Nest's SSE and `StreamableFile` pipe into it unchanged.
- `router.ts`: an Express-style layer stack on `path-to-regexp` v8. Registration order matters, first match wins, `next(err)` jumps to the next 4-arity handler.
- `server.ts`: wraps `Bun.serve()` in a `node:http`-like server object (listen, close, events) that Nest expects.
- `body-parser.ts`, `static.ts`, `views.ts`, `version-filter.ts`: body parsing and limits, static assets, view engines, versioning.

The goal is behavior identical to `@nestjs/platform-express` (Express 5) unless documented in `apps/www/src/content/docs/docs/differences-from-express.md`. When unsure what the adapter should do, match Express.

`adapter.fetch(new Request(...))` runs a request through the full Nest pipeline in-process; tests use it instead of supertest and ports.

## Conventions

- **Tests.** Adapter behavior gets an integration test in `packages/platform/test` that boots a real Nest app on `BunAdapter` and asserts what a client observes (helpers in `test/helpers.ts`; `swagger.test.ts` is the pattern for ecosystem packages). Generator changes get a test in `packages/create/test`.
- **Compatibility table.** Every ✅ row has a test behind it. A new row goes in both `apps/www/src/content/docs/docs/compatibility.md` and `packages/platform/README.md`.
- **Docs.** User-visible changes update the pages in `apps/www/src/content/docs/docs/`. The root `README.md` is for users; contributor material goes in `CONTRIBUTING.md`.
- **Dependencies.** Keep the adapter's runtime dependencies minimal (currently `cors`, `path-to-regexp`). Pin dev dependencies exactly (`bun add -d -E`) and commit `bun.lock`; CI installs with `--frozen-lockfile`. NestJS is pinned in `packages/platform`, `examples/basic`, `bench` and `packages/create/templates`: bump them together.
- **Code style.** ESM with `.js` import extensions, Prettier (`.prettierrc`: single quotes, trailing commas, width 100), oxlint (`.oxlintrc.json`). Markdown is not formatted by Prettier. `packages/create/templates` has its own lint and Prettier config and is excluded from the root lint.
- **TypeScript.** Decorators need `experimentalDecorators`; keep a `tsconfig.json` at the root, since Bun resolves it from the working directory.
- **Templates.** `templates/base` contains no placeholders; it must stay a runnable project. `PLATFORM_VERSION` in `packages/create/src/scaffold.ts` is the adapter range generated projects depend on (the release script updates it).

## Git workflow

- All changes land through pull requests, never direct pushes to `main`: release notes are generated from merged PRs.
- Branch off `main`, open a PR, squash-merge.
- Commits and PR titles follow Conventional Commits: `type(scope): summary`, with scope one of `platform`, `create`, `www`, `bench` when it applies. Example: `fix(platform): honor bodyLimit on urlencoded bodies`. A `commit-msg` hook (commitlint) enforces it; a `pre-commit` hook lints and formats staged files.
- PRs from first-time fork contributors show no checks until a maintainer approves the workflow run.

## Releasing

`bun run release <patch|minor|major|x.y.z>` on a clean `main`: bumps both packages to the same version, builds, tests, commits `chore(release): vX.Y.Z`, tags, and asks before pushing. The pushed tag triggers `release.yml`, which publishes to npm and creates a GitHub release with generated notes. Pushing a `v*` tag publishes, so never push one without being asked.
