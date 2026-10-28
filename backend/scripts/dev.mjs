// Local development server on the same esbuild bundle Vercel runs.
//
//   pnpm --filter backend start:dev          (root: pnpm dev:backend)
//   pnpm --filter backend start:debug        (adds --inspect)
//
// Why not `nest start --watch` / `node dist/main.js`: the API imports the
// workspace package @thekra/practice-core, which ships TypeScript source with
// `.js` import specifiers. Bundlers resolve those; plain Node cannot
// (ERR_MODULE_NOT_FOUND …/practice-core/src/dates.js). So development runs the
// bundle too:
//
//   1. `tsc --watch` compiles src/ to dist/ (it emits the decorator metadata
//      Nest's dependency injection needs, which esbuild does not);
//   2. after every error-free compile, and after an edit to prisma/taxonomy/*.yaml,
//      esbuild rebuilds dist/bundle/ incrementally (scripts/bundle.mjs options,
//      YAML embedded exactly as on Vercel);
//   3. the server (dist/bundle/main.mjs, backend/.env when present) restarts.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { rmSync, watch } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { context } from 'esbuild';
import { assertTaxonomyEmbedded, bundleOptions, outdir } from './bundle.mjs';

const root = resolve(import.meta.dirname, '..');
const debug = process.argv.includes('--debug');
const tscBin = resolve(dirname(createRequire(import.meta.url).resolve('typescript/package.json')), 'bin/tsc');
const TSC_DONE = /Found (\d+) errors?\. Watching for file changes/;

rmSync(outdir, { recursive: true, force: true });
const bundler = await context({ ...bundleOptions(), logLevel: 'warning' });

let server = null;
let pending = Promise.resolve();

async function stopServer() {
  if (!server || server.exitCode !== null || server.signalCode !== null) return;
  const exited = once(server, 'exit');
  server.kill('SIGTERM');
  await exited;
}

function startServer() {
  const flags = [...(debug ? ['--inspect'] : []), '--env-file-if-exists=.env', '--enable-source-maps'];
  server = spawn(process.execPath, [...flags, 'dist/bundle/main.mjs'], { cwd: root, stdio: 'inherit' });
}

/** Rebuilds the bundle and restarts the server; calls queue so two restarts never overlap. */
function rebuildAndRestart(reason) {
  pending = pending.then(async () => {
    try {
      await bundler.rebuild();
      assertTaxonomyEmbedded();
    } catch (error) {
      console.error(`[dev] bundle failed (${reason}); the previous server keeps running.\n${error.message ?? error}`);
      return;
    }
    await stopServer();
    console.log(`[dev] bundle rebuilt (${reason}); starting dist/bundle/main.mjs${debug ? ' with --inspect' : ''}`);
    startServer();
  });
}

const tsc = spawn(process.execPath, [tscBin, '-p', 'tsconfig.build.json', '--watch', '--preserveWatchOutput'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'inherit'],
});
let buffered = '';
tsc.stdout.setEncoding('utf8');
tsc.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
  buffered += chunk;
  const lines = buffered.split('\n');
  buffered = lines.pop() ?? '';
  for (const line of lines) {
    const done = TSC_DONE.exec(line);
    if (!done) continue;
    if (done[1] === '0') rebuildAndRestart('tsc');
    else console.error('[dev] fix the TypeScript errors above; the previous server keeps running.');
  }
});
tsc.on('exit', (code) => {
  if (code !== null && code !== 0) {
    console.error(`[dev] tsc exited with ${code}`);
    void shutdown(1);
  }
});

// The reviewer YAML files are embedded at bundle time, so an edit needs a rebuild.
let yamlTimer = null;
watch(resolve(root, 'prisma/taxonomy'), (_event, file) => {
  if (!file?.endsWith('.yaml')) return;
  clearTimeout(yamlTimer);
  yamlTimer = setTimeout(() => rebuildAndRestart(`prisma/taxonomy/${file}`), 200);
});

async function shutdown(code = 0) {
  tsc.kill('SIGTERM');
  await stopServer();
  await bundler.dispose();
  process.exit(code);
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
