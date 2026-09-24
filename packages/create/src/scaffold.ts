import { cp, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type Adapter = 'express' | 'bun';

export interface ScaffoldOptions {
  /** Target directory (relative to cwd or absolute). */
  dir: string;
  /** Package name written to package.json. Defaults to the directory's basename. */
  name?: string;
  /** HTTP platform. `express` matches `nest new`; `bun` uses @nestbun/platform. */
  adapter?: Adapter;
  /** Overwrite a non-empty directory. */
  force?: boolean;
}

export interface ScaffoldResult {
  dir: string;
  name: string;
  adapter: Adapter;
  files: string[];
}

const here = dirname(fileURLToPath(import.meta.url));
/** Resolves from `src/` (tests) and from `dist/` (published bin) alike. */
export const templatesDir = resolve(here, '..', 'templates');

/** Version range of @nestbun/platform written into generated projects. */
export const PLATFORM_VERSION = '^0.1.0';

export async function scaffold(options: ScaffoldOptions): Promise<ScaffoldResult> {
  const dir = resolve(options.dir);
  const name = options.name ?? toPackageName(dir.split(/[\\/]/).pop() ?? 'nest-bun-app');
  const adapter: Adapter = options.adapter ?? 'express';

  if (existsSync(dir)) {
    const entries = await readdir(dir);
    if (entries.length > 0 && !options.force) {
      throw new Error(`Directory ${dir} is not empty. Pass --force to overwrite.`);
    }
    if (options.force) await rm(dir, { recursive: true, force: true });
  }
  await mkdir(dir, { recursive: true });

  await cp(join(templatesDir, 'base'), dir, { recursive: true });
  // npm strips .gitignore from published packages, so templates ship it unprefixed.
  await rename(join(dir, 'gitignore'), join(dir, '.gitignore'));

  const pkgPath = join(dir, 'package.json');
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8')) as {
    name: string;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    'bun-create'?: unknown;
  };
  pkg.name = name;
  delete pkg['bun-create'];

  let readme = (await readFile(join(dir, 'README.md'), 'utf8')).replace(/^# nest-bun$/m, `# ${name}`);

  if (adapter === 'bun') {
    await cp(join(templatesDir, 'bun-adapter'), dir, { recursive: true, force: true });
    delete pkg.dependencies['@nestjs/platform-express'];
    delete pkg.devDependencies['@types/express'];
    pkg.dependencies['@nestbun/platform'] = PLATFORM_VERSION;
    pkg.dependencies = sortKeys(pkg.dependencies);
    readme = readme
      .replace(
        '- **Bun runtime** — `bun --watch src/main.ts` for dev, `bun test` for unit and e2e tests',
        '- **Bun runtime, natively** — runs on [`@nestbun/platform`](https://mguay22.github.io/nestbun/), a NestJS adapter for `Bun.serve()` (no Express); `bun --watch src/main.ts` for dev, `bun test` for unit and e2e tests',
      )
      .replace(
        'app.e2e.test.ts      boots the app on a random port and hits it with fetch',
        'app.e2e.test.ts      boots the app on Bun.serve at a random port and hits it with fetch',
      );
  }

  await writeFile(join(dir, 'README.md'), readme);
  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

  return { dir, name, adapter, files: await listFiles(dir) };
}

function toPackageName(input: string): string {
  const name = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._@/-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return name || 'nest-bun-app';
}

function sortKeys<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b))) as T;
}

async function listFiles(root: string, prefix = ''): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...(await listFiles(root, rel)));
    else out.push(rel);
  }
  return out.sort();
}
