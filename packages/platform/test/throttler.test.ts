import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SkipThrottle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { bootstrap, type TestApp } from './helpers.js';

@Controller('throttled')
class ThrottledController {
  @Get()
  hit() {
    return { ok: true };
  }

  @SkipThrottle()
  @Get('free')
  free() {
    return { ok: true };
  }
}
@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 2 }])],
  controllers: [ThrottledController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
class ThrottledModule {}

describe('@nestjs/throttler', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await bootstrap(ThrottledModule);
  });
  afterAll(() => t.close());

  it('counts requests per client, sets the rate-limit headers and answers 429 past the limit', async () => {
    const first = await t.fetch('/throttled');
    expect(first.status).toBe(200);
    expect(first.headers.get('x-ratelimit-limit')).toBe('2');
    expect(first.headers.get('x-ratelimit-remaining')).toBe('1');

    const second = await t.fetch('/throttled');
    expect(second.status).toBe(200);
    expect(second.headers.get('x-ratelimit-remaining')).toBe('0');

    const third = await t.json('/throttled');
    expect(third.status).toBe(429);
    expect(third.body.message).toContain('Too Many Requests');
    expect(Number(third.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('lets @SkipThrottle() routes through', async () => {
    for (let i = 0; i < 4; i++) expect((await t.fetch('/throttled/free')).status).toBe(200);
  });
});
