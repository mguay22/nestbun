// Child-process load generator: bun load.ts <url> <method> <seconds> <concurrency> → JSON on stdout
const [url, method, secondsArg, concArg] = process.argv.slice(2) as [string, string, string, string];
const seconds = Number(secondsArg);
const concurrency = Number(concArg);
const init: RequestInit =
  method === 'POST'
    ? { method, headers: { 'content-type': 'application/json' }, body: '{"name":"Ada","age":36}' }
    : { method };
const latencies: number[] = [];
let count = 0;
let errors = 0;
const end = performance.now() + seconds * 1000;
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (performance.now() < end) {
      const t0 = performance.now();
      try {
        const res = await fetch(url, init);
        await res.arrayBuffer();
        if (res.status >= 400) errors++;
      } catch {
        errors++;
      }
      latencies.push(performance.now() - t0);
      count++;
    }
  }),
);
latencies.sort((a, b) => a - b);
const pct = (p: number) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))] ?? 0;
console.log(JSON.stringify({ rps: count / seconds, p50: pct(0.5), p99: pct(0.99), errors }));
