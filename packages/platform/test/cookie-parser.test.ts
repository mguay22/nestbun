import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHmac } from 'node:crypto';
import { Controller, Get, Module, Req } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { bootstrap, type TestApp } from './helpers.js';

const SECRET = 'cookie-secret';

/** The `s:<value>.<hmac>` format cookie-parser verifies (what Express's `res.cookie(..., { signed: true })` writes). */
const sign = (value: string) =>
  `s:${value}.${createHmac('sha256', SECRET).update(value).digest('base64').replace(/=+$/, '')}`;

@Controller('cookies')
class CookiesController {
  @Get()
  read(
    @Req() req: { cookies: Record<string, string>; signedCookies: Record<string, string | false> },
  ) {
    return { cookies: req.cookies, signed: req.signedCookies };
  }
}
@Module({ controllers: [CookiesController] })
class CookiesModule {}

describe('cookie-parser', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await bootstrap(CookiesModule, { configure: (app) => app.use(cookieParser(SECRET)) });
  });
  afterAll(() => t.close());

  it('parses plain cookies into req.cookies', async () => {
    const res = await t.json('/cookies', { headers: { cookie: 'theme=dark; lang=pt-BR' } });
    expect(res.status).toBe(200);
    expect(res.body.cookies).toEqual({ theme: 'dark', lang: 'pt-BR' });
    expect(res.body.signed).toEqual({});
  });

  it('verifies signed cookies into req.signedCookies and rejects tampered ones', async () => {
    const cookie = `session=${encodeURIComponent(sign('abc123'))}; forged=${encodeURIComponent(sign('abc123') + 'x')}`;
    const res = await t.json('/cookies', { headers: { cookie } });
    expect(res.status).toBe(200);
    expect(res.body.signed).toEqual({ session: 'abc123', forged: false });
    expect(res.body.cookies).toEqual({});
  });
});
