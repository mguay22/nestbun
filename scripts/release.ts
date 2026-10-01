/**
 * Cut a release: bun run release <patch|minor|major|x.y.z> [--dry-run]
 *
 * Bumps every public package in packages/* to the same new version, points the generator
 * at the new adapter (PLATFORM_VERSION), commits, tags vX.Y.Z and, after a confirmation,
 * pushes. The pushed tag triggers the Release workflow, which publishes to npm (it needs
 * the NPM_TOKEN repository secret) and creates the GitHub release.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const bump = args.find((arg) => !arg.startsWith('--'));

function fail(message: string): never {
  console.error(`release: ${message}`);
  process.exit(1);
}

function git(...cmd: string[]): string {
  const proc = Bun.spawnSync(['git', ...cmd], { cwd: root });
  if (proc.exitCode !== 0) fail(`git ${cmd.join(' ')} failed\n${proc.stderr.toString()}`);
  return proc.stdout.toString().trim();
}

function run(...cmd: string[]): void {
  const proc = Bun.spawnSync(cmd, { cwd: root, stdio: ['inherit', 'inherit', 'inherit'] });
  if (proc.exitCode !== 0) fail(`${cmd.join(' ')} failed`);
}

const parse = (version: string) => version.split('.').map(Number) as [number, number, number];

if (!bump) fail('usage: bun run release <patch|minor|major|x.y.z> [--dry-run]');
if (!dryRun) {
  if (git('branch', '--show-current') !== 'main') fail('switch to main first');
  if (git('status', '--porcelain')) fail('working tree is not clean');
}

const packages: { file: string; json: { name: string; version: string; private?: boolean } }[] = [];
for (const entry of await readdir(join(root, 'packages'), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const file = join(root, 'packages', entry.name, 'package.json');
  const json = JSON.parse(await readFile(file, 'utf8'));
  if (!json.private) packages.push({ file, json });
}

// Packages share one version, so the tag describes all of them: bump from the highest.
const current = packages
  .map((pkg) => pkg.json.version)
  .reduce((a, b) => (Bun.semver.order(a, b) >= 0 ? a : b));
const [major, minor, patch] = parse(current);
const next =
  bump === 'major'
    ? `${major + 1}.0.0`
    : bump === 'minor'
      ? `${major}.${minor + 1}.0`
      : bump === 'patch'
        ? `${major}.${minor}.${patch + 1}`
        : bump;
if (!/^\d+\.\d+\.\d+$/.test(next)) fail(`"${bump}" is not patch, minor, major or x.y.z`);
if (Bun.semver.order(next, current) <= 0) fail(`${next} is not newer than ${current}`);
const tag = `v${next}`;
if (git('tag', '--list', tag)) fail(`tag ${tag} already exists`);

const [nextMajor, nextMinor] = parse(next);
const platformRange = `^${nextMajor}.${nextMinor}.0`;
const scaffold = join(root, 'packages/create/src/scaffold.ts');
const scaffoldSource = await readFile(scaffold, 'utf8');
const pinned = /PLATFORM_VERSION = '[^']*'/;
if (!pinned.test(scaffoldSource))
  fail('PLATFORM_VERSION not found in packages/create/src/scaffold.ts');

for (const pkg of packages) console.log(`${pkg.json.name}  ${pkg.json.version} → ${next}`);
console.log(`PLATFORM_VERSION → ${platformRange}`);
if (dryRun) {
  console.log(`dry run: would commit "chore(release): ${tag}", tag ${tag} and push`);
  process.exit(0);
}

for (const pkg of packages) {
  const source = await readFile(pkg.file, 'utf8');
  await writeFile(pkg.file, source.replace(/"version": "[^"]*"/, `"version": "${next}"`));
}
await writeFile(scaffold, scaffoldSource.replace(pinned, `PLATFORM_VERSION = '${platformRange}'`));

run('bun', 'install'); // bun.lock records workspace versions
run('bun', 'run', 'build');
run('bun', 'run', 'test');

git('add', '-A');
git('commit', '-m', `chore(release): ${tag}`);
git('tag', tag);

if (prompt(`Push main and ${tag}? This publishes to npm. [y/N]`)?.toLowerCase() !== 'y') {
  console.log(`Not pushed. Publish later with: git push origin main ${tag}`);
  console.log(`Undo with: git tag -d ${tag} && git reset --hard HEAD~1`);
  process.exit(0);
}
run('git', 'push', 'origin', 'main', tag);
console.log(`Pushed ${tag}: https://github.com/mguay22/nestbun/actions/workflows/release.yml`);
