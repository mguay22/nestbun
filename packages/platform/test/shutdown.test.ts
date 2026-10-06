import { describe, expect, it } from 'bun:test';
import { Controller, Get, Module } from '@nestjs/common';
import { bootstrap } from './helpers.js';

@Controller()
class SlowController {
  @Get()
  root() {
    return { ok: true };
  }
  @Get('slow')
  async slow() {
    await Bun.sleep(300);
    return { slow: true };
  }
}
@Module({ controllers: [SlowController] })
class SlowModule {}

/** Settles to the response status, or to the error, so the promise is never left unhandled. */
const settle = (p: Promise<Response>) =>
  p.then(
    async (r) => ({ status: r.status, body: await r.text() }),
    (err: Error) => err,
  );

describe('graceful shutdown', () => {
  it('lets in-flight requests finish before closing', async () => {
    const t = await bootstrap(SlowModule);
    const inFlight = settle(t.fetch('/slow'));
    await Bun.sleep(50);
    const started = Date.now();
    await t.close();

    expect(await inFlight).toEqual({ status: 200, body: '{"slow":true}' });
    expect(Date.now() - started).toBeGreaterThanOrEqual(200);
    await expect(fetch(t.url + '/')).rejects.toThrow();
  });

  it('stops waiting after shutdownTimeout', async () => {
    const t = await bootstrap(SlowModule, { adapter: { serve: { shutdownTimeout: 50 } } });
    const inFlight = settle(t.fetch('/slow'));
    await Bun.sleep(20);
    const started = Date.now();
    await t.close();

    expect(Date.now() - started).toBeLessThan(250);
    expect(await inFlight).toBeInstanceOf(Error);
  });

  it('return503OnClosing answers 503 to new requests while draining', async () => {
    const t = await bootstrap(SlowModule, { app: { return503OnClosing: true } });
    const inFlight = settle(t.fetch('/slow'));
    await Bun.sleep(50);
    const closed = t.close();
    const during = await settle(fetch(t.url + '/'));
    await closed;

    expect(during).toMatchObject({ status: 503 });
    expect(await inFlight).toMatchObject({ status: 200 });
  });
});
