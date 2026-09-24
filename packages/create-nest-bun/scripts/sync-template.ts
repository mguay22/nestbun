/**
 * Pushes templates/base to the standalone template repo (github.com/mguay22/nest-bun)
 * so `bun create mguay22/nest-bun` stays identical to `bun create nest-bun`.
 *
 *   bun run sync-template            # commits and pushes
 *   bun run sync-template --dry-run  # shows the diff only
 */
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REPO = process.env.TEMPLATE_REPO ?? 'https://github.com/mguay22/nest-bun.git';
const dryRun = process.argv.includes('--dry-run');
const base = resolve(import.meta.dirname, '..', 'templates', 'base');

const work = await mkdtemp(join(tmpdir(), 'nest-bun-sync-'));
const sh = async (cmd: string[], cwd = work) => {
  const proc = Bun.spawn(cmd, { cwd, stdout: 'pipe', stderr: 'inherit' });
  const out = await new Response(proc.stdout).text();
  if ((await proc.exited) !== 0) throw new Error(`${cmd.join(' ')} failed`);
  return out.trim();
};

try {
  await sh(['git', 'clone', '--quiet', '--depth', '1', REPO, work], process.cwd());
  // Replace everything except git metadata with the template.
  for (const entry of await Array.fromAsync(new Bun.Glob('*').scan({ cwd: work, dot: true, onlyFiles: false }))) {
    if (entry !== '.git') await rm(join(work, entry), { recursive: true, force: true });
  }
  await cp(base, work, { recursive: true });
  // The template repo is cloned directly, so it needs a real .gitignore.
  await cp(join(work, 'gitignore'), join(work, '.gitignore'));

  await sh(['git', 'add', '-A']);
  const status = await sh(['git', 'status', '--porcelain']);
  if (!status) {
    console.log('Template repo already up to date.');
  } else if (dryRun) {
    console.log(await sh(['git', 'diff', '--cached', '--stat']));
    console.log('\nDry run: nothing pushed.');
  } else {
    await sh(['git', 'commit', '-q', '-m', 'Sync template from nestbun/packages/create-nest-bun']);
    await sh(['git', 'push', '-q']);
    console.log('Pushed template to', REPO);
  }
} finally {
  await rm(work, { recursive: true, force: true });
}
