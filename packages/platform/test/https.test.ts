import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Controller, Get, Module, Req } from '@nestjs/common';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BunRequest } from '../src/index.js';
import { bootstrap, type TestApp } from './helpers.js';

@Controller()
class RootController {
  @Get()
  root(@Req() req: BunRequest) {
    return { protocol: req.protocol, secure: req.secure };
  }
}
@Module({ controllers: [RootController] })
class RootModule {}

/** A throwaway self-signed certificate, generated per run so no key is ever committed. */
async function selfSigned(): Promise<{ key: string; cert: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'nestbun-tls-'));
  const key = join(dir, 'key.pem');
  const cert = join(dir, 'cert.pem');
  const args = [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-days',
    '1',
    '-subj',
    '/CN=localhost',
  ];
  const { exitCode, stderr } = Bun.spawnSync(['openssl', ...args, '-keyout', key, '-out', cert], {
    stdout: 'ignore',
    stderr: 'pipe',
  });
  if (exitCode !== 0) throw new Error(`openssl failed: ${stderr.toString()}`);
  return { key: await readFile(key, 'utf8'), cert: await readFile(cert, 'utf8') };
}

// The certificate is self-signed, so the client skips chain validation.
const insecure = { tls: { rejectUnauthorized: false } } as RequestInit;

describe('httpsOptions', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await bootstrap(RootModule, { app: { httpsOptions: await selfSigned() } });
  });
  afterAll(() => t.close());

  it('serves over TLS and reports an https URL', async () => {
    expect(t.url).toStartWith('https://');
    const r = await t.fetch('/', insecure);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ protocol: 'https', secure: true });
  });

  it('does not answer plain HTTP on the TLS port', async () => {
    const plain = t.url.replace('https://', 'http://');
    const outcome = await fetch(plain + '/').then(
      (r) => r.status,
      (err: Error) => err,
    );
    expect(outcome).not.toBe(200);
  });
});
