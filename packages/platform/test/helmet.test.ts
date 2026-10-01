import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Controller, Get, Module } from '@nestjs/common';
import helmet from 'helmet';
import { bootstrap, type TestApp } from './helpers.js';

@Controller('secure')
class SecureController {
  @Get()
  get() {
    return { ok: true };
  }
}
@Module({ controllers: [SecureController] })
class SecureModule {}

describe('helmet', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await bootstrap(SecureModule, { configure: (app) => app.use(helmet()) });
  });
  afterAll(() => t.close());

  it('sets the security headers on every response', async () => {
    const res = await t.json('/secure');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(res.headers.get('strict-transport-security')).toContain('max-age=');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
  });

  it('applies to 404s too', async () => {
    const res = await t.fetch('/missing');
    expect(res.status).toBe(404);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });
});
