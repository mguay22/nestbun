# Handoff: benchmarking `@nestjs/platform-node` (branch `chore/bench-platform-node`)

> Working note for this branch only. Delete this file before the PR is merged.

## Goal

NestJS 12.3 shipped a first-party Node adapter, `@nestjs/platform-node` (built directly on `node:http`; announced as "the fastest way to run Nest"). Add it to `bench/`, get the most accurate numbers we can, and only then update the published benchmarks and docs.

**Rule: do not touch published numbers or docs until the maintainer has reviewed and approved the final results.** That covers `apps/www/src/components/BenchChart.astro`, `apps/www/src/content/docs/docs/benchmarks.mdx`, and the speed table in `packages/platform/README.md`.

## What is on this branch

- **Nest bumped 12.1.0 → 12.3.2** (`common`, `core`, `platform-express`, `platform-fastify`, `testing`) in `bench`, `packages/platform`, `examples/basic` and `packages/create/templates/base`. `@nestjs/terminus` stays at 12.1.0 because it is versioned separately and that is its latest. Build, lint, format:check, typecheck and test all passed after the bump.
- **`@nestjs/platform-node@12.3.2`** added to `bench` (exported class: `NodeAdapter`).
- **Benchmark harness rewritten for accuracy:**
  - `bench/server.ts` (new) boots one target per process: `raw-bun`, `router-only`, `nest-express`, `nest-fastify`, `nest-node`, `nest-bun`. It prints the URL on stdout.
  - `bench/bench.ts` (rewritten) is the orchestrator. It picks the load generator in the order `wrk`, then `oha`, then the fetch loader (override with `LOADER=`). It checks GET and POST responses before measuring, aborts on any non-2xx or socket error under load, runs a discarded warmup per scenario, rotates target order each round, and prints the median and min–max per cell.
  - `bench/post.lua` (new) is the POST body script for `wrk`.
  - The old `oha` path was broken: oha 1.16 removed `-j`. It now uses `--output-format json`.
- Env knobs: `ROUNDS` (3), `WARMUP` (2s), `DURATION` (5s), `CONCURRENCY` (64), `THREADS` (4, for wrk), `COOLDOWN` (1s), `TARGETS`, `LOADER`.

## Key findings so far

1. **The old fetch-based loader was the bottleneck.** Against raw `Bun.serve` on an Apple M5, the fetch loader reached 168k req/s and `wrk` reached 232k. `wrk` stays flat from 64 to 256 connections and with 2 or 4 threads, so the server is saturated, which is what we want. The currently published numbers (raw `Bun.serve` at 158k) were capped by the client, and that compressed the gaps between adapters.
2. **On Bun, `platform-node` ties us on GET and beats us on POST.** Smoke run (`wrk`, 1 round, 2s, on battery, so indicative only):

   | target | GET | POST |
   |---|---:|---:|
   | nest-express | 122k | 94k |
   | nest-fastify | 142k | 120k |
   | nest-node | 156k | **131k** |
   | nest-bun | 157k | 127k |
   | router-only | 177k | 158k |
   | raw-bun | 225k | 189k |

   Earlier fetch-loader runs (median of 3) showed the same shape: we were +3% on GET and −2% on POST versus nest-node.
3. **Why `platform-node` is competitive on Bun.** Bun's `node:http` is implemented on the same native server as `Bun.serve`, so both adapters share the socket and HTTP parsing layer. The difference is purely in the JS layer. Our `BunRequest` and `BunResponse` are Node `Readable`/`Writable` streams with Express-shaped fields, which keeps Express middleware, SSE and `StreamableFile` compatible but costs per request. Going from raw to router-only loses 21% on GET; adding Nest costs 11% more on GET but 20% on POST. That suggests the body handoff between the adapter and Nest is where we lose on POST. **This is a hypothesis; nothing has been profiled yet.**

## Next steps

1. **Environment.** Plug in to AC power, make sure low power mode is off (`pmset -g | grep lowpowermode`), close Chrome and other heavy apps, and let the machine idle until `uptime` load is low.
2. **Install load generators:** `brew install wrk oha`.
3. **Set up:** `bun install && bun run build`, since the bench imports `@nestbun/platform` from its build output.
4. **Final run with wrk** (about 20 minutes):
   ```bash
   cd bench && ROUNDS=7 WARMUP=3 DURATION=10 COOLDOWN=3 bun run bench.ts | tee results-wrk.txt
   ```
5. **Cross-check with oha**, to confirm the ranking does not depend on the loader:
   ```bash
   LOADER=oha ROUNDS=5 WARMUP=3 DURATION=10 COOLDOWN=3 bun run bench.ts | tee results-oha.txt
   ```
6. **Ceiling check on the new machine.** Confirm the client is not the bottleneck by checking that raw-bun req/s stays flat across `CONCURRENCY=64,128,256` and `THREADS=2,4,8`. If it rises with concurrency, use the higher setting for the final run.
7. **Profile POST:** nest-bun vs nest-node, for example `bun --cpu-prof bench/server.ts nest-bun` under wrk load, to find the real hot spots before deciding whether to optimize the adapter first and publish after.
8. **Optional runtime comparison:** `platform-node` on Node vs on Bun vs `@nestbun/platform` on Bun. That is the comparison where Bun's advantage actually shows.
9. **Report results to the maintainer.** After approval, update the chart, `benchmarks.mdx` (methodology: wrk, rounds, warmup, median, hardware, Nest 12.3.2, add the platform-node row) and the README speed table. Also review the "faster than Express and Fastify" claims in `apps/www` (`astro.config.mjs`, `index.astro`, `scripts/og.ts`); they are still true, but platform-node is now the relevant comparison. Then open the PR with title `chore(bench): add @nestjs/platform-node and harden benchmark harness` and delete this file.

## Machine used so far

Apple M5 (4 P-cores and 6 E-cores), macOS 26 (Darwin 25.2), Bun 1.4.2, on battery (63%), load average about 3. Treat all numbers above as preliminary.
