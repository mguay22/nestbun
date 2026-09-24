import * as p from '@clack/prompts';
import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import pc from 'picocolors';
import { scaffold, type Adapter } from './scaffold.js';

const HELP = `
${pc.bold('@nestbun/create')} — NestJS on the Bun runtime

${pc.dim('Usage')}
  bun create @nestbun [dir] [options]
  bunx @nestbun/create [dir] [options]

${pc.dim('Options')}
  --adapter <express|bun>   HTTP platform. ${pc.dim('express')} matches nest new (default);
                            ${pc.dim('bun')} runs on Bun.serve() via @nestbun/platform
  --name <pkg>              package.json name (defaults to the directory name)
  --no-install              skip bun install
  --no-git                  skip git init
  --yes                     accept defaults, never prompt (-y works with bunx only)
  -f, --force               overwrite a non-empty directory
  -h, --help                show this help
`;

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    allowNegative: true, // --no-install, --no-git
    options: {
      adapter: { type: 'string' },
      name: { type: 'string' },
      install: { type: 'boolean', default: true },
      git: { type: 'boolean', default: true },
      yes: { type: 'boolean', short: 'y', default: false },
      force: { type: 'boolean', short: 'f', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help) {
    console.log(HELP);
    return;
  }

  const interactive = Boolean(process.stdout.isTTY) && !values.yes;
  p.intro(pc.bgCyan(pc.black(' @nestbun/create ')));

  let dir = positionals[0];
  if (!dir) {
    if (!interactive) throw new Error('Missing project directory. Usage: bun create @nestbun my-api');
    const answer = await p.text({
      message: 'Where should we create your project?',
      placeholder: './my-api',
      validate: (v) => (v?.trim() ? undefined : 'Enter a directory name'),
    });
    if (p.isCancel(answer)) return cancel();
    dir = answer.trim();
  }

  let adapter = values.adapter as Adapter | undefined;
  if (adapter && adapter !== 'express' && adapter !== 'bun') {
    throw new Error(`Unknown adapter "${adapter}". Use "express" or "bun".`);
  }
  if (!adapter) {
    if (!interactive) {
      adapter = 'express';
    } else {
      const answer = await p.select<Adapter>({
        message: 'HTTP platform',
        options: [
          { value: 'express', label: 'Express', hint: 'same as nest new; runs on Bun through node:http' },
          { value: 'bun', label: 'Bun.serve (native)', hint: '@nestbun/platform; fastest, no Express' },
        ],
        initialValue: 'express',
      });
      if (p.isCancel(answer)) return cancel();
      adapter = answer;
    }
  }

  const s = p.spinner();
  s.start('Copying template');
  const result = await scaffold({ dir, name: values.name, adapter, force: values.force });
  s.stop(`Created ${pc.cyan(result.name)} with the ${pc.cyan(adapter)} adapter (${result.files.length} files)`);

  if (values.install) {
    s.start('Installing dependencies with bun');
    await run('bun', ['install'], result.dir);
    s.stop('Dependencies installed');
  }
  if (values.git) {
    try {
      await run('git', ['init', '-q'], result.dir);
      await run('git', ['add', '-A'], result.dir);
      p.log.success('Initialized a git repository');
    } catch {
      p.log.warn('git not found, skipped git init');
    }
  }

  p.note([`cd ${dir}`, values.install ? '' : 'bun install', 'bun dev'].filter(Boolean).join('\n'), 'Next steps');
  p.outro(`Docs: ${pc.underline('https://mguay22.github.io/nestbun/')}`);
}

function cancel(): void {
  p.cancel('Cancelled.');
  process.exit(0);
}

function run(cmd: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'ignore', 'inherit'] });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited with ${code}`))));
  });
}

main().catch((error: Error) => {
  p.log.error(error.message);
  process.exit(1);
});
