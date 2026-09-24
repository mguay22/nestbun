# nestbun

NestJS on the Bun runtime, natively.

| Package | What | Status |
|---|---|---|
| [`@nestbun/platform`](./packages/platform) | HTTP adapter running Nest on `Bun.serve()` | ready |
| `@nestbun/ws` | WebSocket gateway adapter on `Bun.serve({ websocket })` | planned |
| [`create-nest-bun`](./packages/create-nest-bun) | `nest new`, but on Bun: `bun create nest-bun my-api [--adapter bun]` | ready |

```ts
const app = await NestFactory.create<NestBunApplication>(AppModule, new BunAdapter());
await app.listen(3000);
```

## Repo layout

```
packages/platform   the adapter (+ 44 integration tests against real Nest apps)
packages/create-nest-bun   the generator; templates/base is the starter it copies
examples/basic      minimal app: REST + Zod validation + SSE
bench/              same app on express / fastify / bun adapters, one runtime
apps/www            landing page + docs (Astro + Starlight) → https://mguay22.github.io/nestbun/
```

## Develop

```bash
bun install
bun test packages               # adapter test suite
bun run --filter '*' typecheck
bun run bench                   # ~1 minute, prints a markdown table
cd examples/basic && bun dev    # http://localhost:3000/cats
```

## License

MIT
