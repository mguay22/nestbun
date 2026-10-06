import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Body, Controller, Get, Module, Post } from '@nestjs/common';
import { bootstrap, jsonInit, type TestApp } from './helpers.js';

@Controller()
class FormController {
  @Get()
  page() {
    return { ok: true };
  }
  @Post('submit')
  submit(@Body() body: unknown) {
    return { received: body };
  }
}
@Module({ controllers: [FormController] })
class FormModule {}

describe('security hooks (useSecurityHeaders, enableCsrfProtection)', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await bootstrap(FormModule, {
      configure: (app) => {
        app.useSecurityHeaders();
        app.enableCsrfProtection({ trustedOrigins: ['https://trusted.example'] });
      },
    });
  });
  afterAll(() => t.close());

  it('adds the default security headers', async () => {
    const r = await t.fetch('/');
    expect(r.status).toBe(200);
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(r.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    expect(r.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(r.headers.get('strict-transport-security')).toContain('max-age=');
  });

  it('allows safe methods, same-origin and non-browser requests', async () => {
    expect((await t.fetch('/', { headers: { 'sec-fetch-site': 'cross-site' } })).status).toBe(200);

    const sameOrigin = await t.json(
      '/submit',
      jsonInit('POST', { a: 1 }, { 'sec-fetch-site': 'same-origin' }),
    );
    expect(sameOrigin.status).toBe(201);
    expect(sameOrigin.body).toEqual({ received: { a: 1 } });

    expect((await t.fetch('/submit', jsonInit('POST', { a: 1 }))).status).toBe(201);
  });

  it('rejects cross-origin writes with 403, still sending the security headers', async () => {
    const bySecFetchSite = await t.json(
      '/submit',
      jsonInit('POST', {}, { 'sec-fetch-site': 'cross-site' }),
    );
    expect(bySecFetchSite.status).toBe(403);
    expect(bySecFetchSite.headers.get('x-content-type-options')).toBe('nosniff');

    const byOrigin = await t.fetch(
      '/submit',
      jsonInit('POST', {}, { origin: 'https://evil.example' }),
    );
    expect(byOrigin.status).toBe(403);
  });

  it('lets trusted origins through', async () => {
    const r = await t.fetch(
      '/submit',
      jsonInit('POST', {}, { origin: 'https://trusted.example', 'sec-fetch-site': 'cross-site' }),
    );
    expect(r.status).toBe(201);
  });
});
