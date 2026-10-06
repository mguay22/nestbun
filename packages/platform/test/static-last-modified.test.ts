import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Module } from '@nestjs/common';
import { mkdtemp, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bootstrap, type TestApp } from './helpers.js';

@Module({})
class EmptyModule {}

const MTIME = new Date('2026-01-02T03:04:05Z');

describe('static assets: Last-Modified', () => {
  let t: TestApp;
  beforeAll(async () => {
    const dir = await mkdtemp(join(tmpdir(), 'nestbun-last-modified-'));
    const file = join(dir, 'app.css');
    await writeFile(file, 'body{}');
    await utimes(file, MTIME, MTIME);
    t = await bootstrap(EmptyModule, {
      configure: (app) => {
        app.useStaticAssets(dir, { prefix: '/etag' });
        app.useStaticAssets(dir, { prefix: '/dates', etag: false });
      },
    });
  });
  afterAll(() => t.close());

  it('sends the file mtime as Last-Modified', async () => {
    const r = await t.fetch('/dates/app.css');
    expect(r.status).toBe(200);
    expect(r.headers.get('last-modified')).toBe(MTIME.toUTCString());
    expect(r.headers.get('etag')).toBeNull();
  });

  it('answers 304 when If-Modified-Since is at or after the mtime, 200 when older', async () => {
    const same = await t.fetch('/dates/app.css', {
      headers: { 'if-modified-since': MTIME.toUTCString() },
    });
    expect(same.status).toBe(304);
    expect(await same.text()).toBe('');

    const later = await t.fetch('/dates/app.css', {
      headers: { 'if-modified-since': new Date(MTIME.getTime() + 60_000).toUTCString() },
    });
    expect(later.status).toBe(304);

    const older = await t.fetch('/dates/app.css', {
      headers: { 'if-modified-since': new Date(MTIME.getTime() - 60_000).toUTCString() },
    });
    expect(older.status).toBe(200);
    expect(await older.text()).toBe('body{}');
  });

  it('ignores If-Modified-Since when If-None-Match is present', async () => {
    const r = await t.fetch('/etag/app.css', {
      headers: { 'if-none-match': 'W/"stale"', 'if-modified-since': MTIME.toUTCString() },
    });
    expect(r.status).toBe(200);
    expect(r.headers.get('last-modified')).toBe(MTIME.toUTCString());
  });
});
