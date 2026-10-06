import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BunAdapter, type NestBunApplication } from '../src/index.js';

@Controller()
class RootController {
  @Get()
  root() {
    return { ok: true };
  }
}
@Module({ controllers: [RootController] })
class RootModule {}

describe('unix socket listen', () => {
  let app: NestBunApplication;
  let socketPath: string;
  beforeAll(async () => {
    socketPath = join(await mkdtemp(join(tmpdir(), 'nestbun-unix-')), 'app.sock');
    app = await NestFactory.create<NestBunApplication>(RootModule, new BunAdapter(), {
      logger: false,
    });
    await app.listen(socketPath);
  });
  afterAll(() => app.close());

  it('serves requests over the socket and reports its path as the address', async () => {
    const r = await fetch('http://localhost/', { unix: socketPath });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    expect(app.getHttpServer().address()).toBe(socketPath);
  });
});
