import { afterAll, describe, expect, it } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scaffold, type Adapter } from '../src/scaffold.js';

const root = await mkdtemp(join(tmpdir(), 'create-nest-bun-'));
afterAll(() => rm(root, { recursive: true, force: true }));

/** Generate, install, type-check, test, and boot the result. The real thing, not a snapshot. */
async function generateAndVerify(adapter: Adapter) {
  const dir = join(root, `app-${adapter}`);
  const result = await scaffold({ dir, adapter });
  expect(result.files).toContain('.gitignore');
  expect(result.files).not.toContain('gitignore');

  const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
  expect(pkg.name).toBe(`app-${adapter}`);
  expect(pkg['bun-create']).toBeUndefined();

  await exec(['bun', 'install'], dir);
  await exec(['bun', 'run', 'typecheck'], dir);
  await exec(['bun', 'test'], dir);

  // Boot it on a random port and hit it.
  const server = Bun.spawn(['bun', 'src/main.ts'], { cwd: dir, env: { ...process.env, PORT: '0' }, stdout: 'pipe', stderr: 'pipe' });
  try {
    const port = await waitForPort(server.stdout);
    const res = await fetch(`http://localhost:${port}/`);
    expect(await res.text()).toBe('Hello World!');
  } finally {
    server.kill();
  }
  return { dir, pkg };
}

describe('create-nest-bun', () => {
  it('express (default) generates the same project as the nest-bun template', async () => {
    const { pkg } = await generateAndVerify('express');
    expect(pkg.dependencies['@nestjs/platform-express']).toBeDefined();
    expect(pkg.dependencies['@nestbun/platform']).toBeUndefined();
  }, 120_000);

  it('--adapter bun swaps in @nestbun/platform', async () => {
    const { dir, pkg } = await generateAndVerify('bun');
    expect(pkg.dependencies['@nestbun/platform']).toBeDefined();
    expect(pkg.dependencies['@nestjs/platform-express']).toBeUndefined();
    expect(pkg.devDependencies['@types/express']).toBeUndefined();
    expect(await readFile(join(dir, 'src/main.ts'), 'utf8')).toContain('new BunAdapter()');
    expect(await readFile(join(dir, 'README.md'), 'utf8')).toContain('@nestbun/platform');
  }, 120_000);

  it('refuses a non-empty directory unless forced', async () => {
    const dir = join(root, 'app-express');
    await expect(scaffold({ dir })).rejects.toThrow(/not empty/);
    await expect(scaffold({ dir, force: true, name: 'forced' })).resolves.toMatchObject({ name: 'forced' });
  });
});

async function exec(cmd: string[], cwd: string): Promise<void> {
  const proc = Bun.spawn(cmd, { cwd, stdout: 'pipe', stderr: 'pipe' });
  const [out, err] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
  if ((await proc.exited) !== 0) throw new Error(`${cmd.join(' ')} failed in ${cwd}\n${out}\n${err}`);
}

async function waitForPort(stdout: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stdout.getReader();
  let buffered = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) throw new Error(`Server exited before listening:\n${buffered}`);
    buffered += new TextDecoder().decode(value);
    const match = /Listening on https?:\/\/\S+:(\d+)/.exec(buffered);
    if (match) return match[1]!;
  }
}
