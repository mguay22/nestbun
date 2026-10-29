/**
 * Same Nest app, four adapters, one runtime (Bun), plus two baselines. Each target
 * runs in its own server process; load comes from `wrk` if installed, else `oha`,
 * else a fetch-based loader in a separate process. Every scenario gets a discarded
 * warmup, and rounds rotate the target order so thermal drift is spread evenly.
 * Reports the median and min–max across rounds.
 *
 *   bun run bench
 *   TARGETS=nest-bun,nest-node ROUNDS=5 DURATION=10 bun run bench
 *   LOADER=oha bun run bench
 */
const DURATION = Number(process.env.DURATION ?? 5);
const WARMUP = Number(process.env.WARMUP ?? 2);
const ROUNDS = Number(process.env.ROUNDS ?? 3);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 64);
const THREADS = Number(process.env.THREADS ?? 4);
const COOLDOWN = Number(process.env.COOLDOWN ?? 1);
const TARGETS = (
  process.env.TARGETS ?? 'raw-bun,router-only,nest-express,nest-fastify,nest-node,nest-bun'
).split(',');
const SCENARIOS = ['GET /users/42', 'POST /users'] as const;
const BODY = '{"name":"Ada","age":36}';

type Loader = 'wrk' | 'oha' | 'fetch';
const LOADER = (process.env.LOADER ??
  (Bun.which('wrk') ? 'wrk' : Bun.which('oha') ? 'oha' : 'fetch')) as Loader;
const here = (file: string) => new URL(file, import.meta.url).pathname;

console.log(
  `runtime bun ${Bun.version} · ${LOADER} · ${ROUNDS} rounds × ${WARMUP}s warmup + ${DURATION}s × ${CONCURRENCY} conns\n`,
);

const samples = new Map<string, Array<{ rps: number; p99: number }>>();

for (let round = 0; round < ROUNDS; round++) {
  const order = TARGETS.map((_, i) => TARGETS[(i + round) % TARGETS.length]!);
  for (const target of order) {
    const server = await boot(target);
    try {
      await verify(server.url);
      for (const scenario of SCENARIOS) {
        if (WARMUP > 0) await load(server.url, scenario, WARMUP);
        const r = await load(server.url, scenario, DURATION);
        const key = `${target}\t${scenario}`;
        samples.set(key, [...(samples.get(key) ?? []), r]);
        console.log(
          `round ${round + 1}  ${target.padEnd(12)} ${scenario.padEnd(14)} ${String(Math.round(r.rps)).padStart(8)} req/s   p99 ${r.p99.toFixed(2)}ms`,
        );
      }
    } finally {
      server.proc.kill();
      await server.proc.exited;
    }
    await Bun.sleep(COOLDOWN * 1000);
  }
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const k = (n: number) => `${(n / 1000).toFixed(1)}k`;

console.log('\n| target | scenario | req/s (median) | min–max | p99 (median) |');
console.log('|---|---|---:|---:|---:|');
for (const target of TARGETS)
  for (const scenario of SCENARIOS) {
    const s = samples.get(`${target}\t${scenario}`) ?? [];
    const rps = s.map((x) => x.rps);
    console.log(
      `| ${target} | ${scenario} | ${Math.round(median(rps))} | ${k(Math.min(...rps))}–${k(Math.max(...rps))} | ${median(s.map((x) => x.p99)).toFixed(2)}ms |`,
    );
  }

async function boot(target: string) {
  const proc = Bun.spawn(['bun', here('./server.ts'), target], {
    stdout: 'pipe',
    stderr: 'inherit',
  });
  const reader = proc.stdout.getReader();
  let out = '';
  while (!out.includes('\n')) {
    const { value, done } = await reader.read();
    if (done) throw new Error(`${target} exited before listening`);
    out += new TextDecoder().decode(value);
  }
  reader.releaseLock();
  return { proc, url: out.trim() };
}

// Fail fast if a target does not answer both scenarios correctly.
async function verify(url: string) {
  const get = await fetch(url + '/users/42');
  const got = await get.json();
  if (get.status !== 200 || got.id !== '42') throw new Error(`GET ${url}: ${get.status}`);
  const post = await fetch(url + '/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: BODY,
  });
  const created = await post.json();
  if (post.status !== 201 || created.created?.name !== 'Ada')
    throw new Error(`POST ${url}: ${post.status}`);
}

async function load(url: string, scenario: string, seconds: number) {
  const [method, path] = scenario.split(' ') as [string, string];
  if (LOADER === 'wrk') return wrk(url + path, method, seconds);
  if (LOADER === 'oha') return oha(url + path, method, seconds);
  return builtin(url + path, method, seconds);
}

async function run(cmd: string[]) {
  const proc = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'pipe' });
  const [out, err] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  if ((await proc.exited) !== 0) throw new Error(`${cmd[0]} failed: ${err}`);
  return out;
}

async function wrk(url: string, method: string, seconds: number) {
  const args = ['wrk', `-t${THREADS}`, `-c${CONCURRENCY}`, `-d${seconds}s`, '--latency'];
  if (method === 'POST') args.push('-s', here('./post.lua'));
  const out = await run([...args, url]);
  const errors =
    Number(out.match(/Non-2xx or 3xx responses: (\d+)/)?.[1] ?? 0) +
    [...(out.match(/Socket errors: (.*)/)?.[1] ?? '').matchAll(/\d+/g)].reduce(
      (n, m) => n + Number(m[0]),
      0,
    );
  if (errors) throw new Error(`${method} ${url}: ${errors} errors under load`);
  const [, value, unit] = out.match(/99%\s+([\d.]+)(us|ms|s)/)!;
  return {
    rps: Number(out.match(/Requests\/sec:\s+([\d.]+)/)![1]),
    p99: Number(value) * { us: 0.001, ms: 1, s: 1000 }[unit as 'us' | 'ms' | 's'],
  };
}

async function oha(url: string, method: string, seconds: number) {
  const args = ['oha', '-z', `${seconds}s`, '-c', String(CONCURRENCY), '--no-tui'];
  args.push('--output-format', 'json', '-m', method);
  if (method === 'POST') args.push('-H', 'content-type: application/json', '-d', BODY);
  const out = JSON.parse(await run([...args, url]));
  const errors = Object.entries(out.statusCodeDistribution as Record<string, number>)
    .filter(([code]) => Number(code) >= 400)
    .reduce((n, [, c]) => n + c, 0);
  if (errors) throw new Error(`${method} ${url}: ${errors} errors under load`);
  return {
    rps: out.summary.requestsPerSec as number,
    p99: (out.latencyPercentiles.p99 as number) * 1000,
  };
}

async function builtin(url: string, method: string, seconds: number) {
  const out = JSON.parse(
    await run(['bun', here('./load.ts'), url, method, String(seconds), String(CONCURRENCY)]),
  ) as { rps: number; p99: number; errors: number };
  if (out.errors) throw new Error(`${method} ${url}: ${out.errors} errors under load`);
  return { rps: out.rps, p99: out.p99 };
}
