/**
 * Same Nest app, three adapters, one runtime (Bun). Measures requests/second
 * for a JSON GET and a JSON POST using `oha` if installed, else a built-in
 * fetch-based load generator.
 *
 *   bun run bench            # all adapters
 *   ADAPTERS=bun,express DURATION=5 CONCURRENCY=64 bun run bench
 */
import 'reflect-metadata';
import { Body, Controller, Get, Module, Param, Post } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { BunAdapter, BunRequest, BunResponse, Router } from '@nestbun/platform';
import { ExpressAdapter } from '@nestjs/platform-express';
import { FastifyAdapter } from '@nestjs/platform-fastify';

@Controller('users')
class UsersController {
  @Get(':id')
  one(@Param('id') id: string) {
    return { id, name: 'Ada', email: 'ada@example.com', roles: ['admin', 'dev'] };
  }
  @Post()
  create(@Body() body: unknown) {
    return { created: body };
  }
}
@Module({ controllers: [UsersController] })
class AppModule {}

const DURATION = Number(process.env.DURATION ?? 5);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 64);
const wanted = (process.env.ADAPTERS ?? 'express,fastify,bun').split(',');

const adapters: Record<string, () => any> = {
  express: () => new ExpressAdapter(),
  fastify: () => new FastifyAdapter(),
  bun: () => new BunAdapter(),
};

const hasOha = Bun.which('oha') !== null;
console.log(`runtime bun ${Bun.version} · ${hasOha ? 'oha' : 'fetch loader (separate process)'} · ${DURATION}s × ${CONCURRENCY} conns\n`);

const results: Array<{ adapter: string; scenario: string; rps: number; p99: string }> = [];
const SCENARIOS = ['GET /users/42', 'POST /users'] as const;

async function measure(name: string, url: string) {
  for (const scenario of SCENARIOS) {
    const r = hasOha ? await oha(url, scenario) : await builtin(url, scenario);
    results.push({ adapter: name, scenario, ...r });
    console.log(`${name.padEnd(12)} ${scenario.padEnd(14)} ${String(Math.round(r.rps)).padStart(8)} req/s   p99 ${r.p99}`);
  }
}

// Baselines: what the runtime itself can do, and what our router costs without Nest.
if (process.env.BASELINES !== '0') {
  const raw = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    fetch: async (req) =>
      req.method === 'POST'
        ? Response.json({ created: await req.json() })
        : Response.json({ id: '42', name: 'Ada', email: 'ada@example.com', roles: ['admin', 'dev'] }),
  });
  await measure('raw-bun', raw.url.origin);
  await raw.stop(true);

  const router = new Router();
  router.use(async (req, _res, next) => {
    if (req.method === 'POST') req.body = await req.native.json();
    next();
  });
  router.get('/users/:id', (req, res) => res.json({ id: req.params.id, name: 'Ada', email: 'ada@example.com', roles: ['admin', 'dev'] }));
  router.post('/users', (req, res) => res.status(201).json({ created: req.body }));
  const routed = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    fetch: (request, server) => {
      const req = new BunRequest(request, { server });
      const res = new BunResponse(req);
      return router.handle(req, res);
    },
  });
  await measure('router-only', routed.url.origin);
  await routed.stop(true);
}

for (const name of wanted) {
  const app = await NestFactory.create(AppModule, adapters[name]!(), { logger: false });
  await app.listen(0, '127.0.0.1');
  await measure(`nest-${name}`, await app.getUrl());
  await app.close();
}

console.log('\n| adapter | scenario | req/s | p99 |\n|---|---|---:|---:|');
for (const r of results) console.log(`| ${r.adapter} | ${r.scenario} | ${Math.round(r.rps)} | ${r.p99} |`);

async function oha(url: string, scenario: string) {
  const [method, path] = scenario.split(' ') as [string, string];
  const args = ['oha', '-z', `${DURATION}s`, '-c', String(CONCURRENCY), '--no-tui', '-j', '-m', method];
  if (method === 'POST') args.push('-H', 'content-type: application/json', '-d', '{"name":"Ada","age":36}');
  const proc = Bun.spawn([...args, url + path], { stdout: 'pipe', stderr: 'ignore' });
  const out = JSON.parse(await new Response(proc.stdout).text());
  return { rps: out.summary.requestsPerSec as number, p99: `${(out.latencyPercentiles.p99 * 1000).toFixed(2)}ms` };
}

async function builtin(url: string, scenario: string) {
  const [method, path] = scenario.split(' ') as [string, string];
  const proc = Bun.spawn(['bun', new URL('./load.ts', import.meta.url).pathname, url + path, method, String(DURATION), String(CONCURRENCY)], {
    stdout: 'pipe',
    stderr: 'inherit',
  });
  const out = JSON.parse(await new Response(proc.stdout).text()) as { rps: number; p99: number; errors: number };
  if (out.errors) console.warn(`  (${out.errors} errors)`);
  return { rps: out.rps, p99: `${out.p99.toFixed(2)}ms` };
}
