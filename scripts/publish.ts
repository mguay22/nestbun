/**
 * Publish each public package in packages/* whose (name, version) is not on npm yet.
 * Used by the Release workflow; also fine to run locally after `npm login`.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', 'packages');

for (const entry of await readdir(root, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const dir = join(root, entry.name);
  const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8')) as { name: string; version: string; private?: boolean };
  if (pkg.private) continue;

  const view = Bun.spawn(['npm', 'view', `${pkg.name}@${pkg.version}`, 'version'], { stdout: 'pipe', stderr: 'pipe' });
  const published = (await view.exited) === 0 && (await new Response(view.stdout).text()).trim() === pkg.version;
  if (published) {
    console.log(`skip    ${pkg.name}@${pkg.version} (already on npm)`);
    continue;
  }

  console.log(`publish ${pkg.name}@${pkg.version}`);
  const proc = Bun.spawn(['bun', 'publish', '--access', 'public'], { cwd: dir, stdout: 'inherit', stderr: 'inherit' });
  if ((await proc.exited) !== 0) process.exit(1);
}
