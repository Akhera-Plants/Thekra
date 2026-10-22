// Local gate that stands in for Vercel's function loader.
//
// Vercel's loader (/opt/rust/nodejs.js) disables require(esm); Node >= 22.12
// enables it by default, which hides ERR_REQUIRE_ESM locally. Every leg below
// therefore runs with `node --no-experimental-require-module`.
//
//   pnpm --filter backend gate:vercel      (builds first, needs the .env DB)
//
// Legs: bundled server (dev env, prod env, and without the flag), the
// serverless handler called through a plain http server (once from the repo,
// once from a replica of the Vercel function tree), and a negative control
// proving the un-bundled dist/main.js still fails the way Vercel did.
//
// The function-tree leg matters because the repo legs run with cwd = backend/
// and every source file within reach: a runtime read of a file Vercel does not
// ship (relative to process.cwd() or to the module) passes there and fails in
// production. The replica holds only what the function holds: api/index.mjs,
// the serverless bundle, vercel.json `includeFiles`, and the bundle's externals
// (scripts/bundle-externals.mjs) in node_modules. Its cwd is the tree root, as
// /var/task is on Vercel (the bundle sits at /var/task/backend/dist/bundle/).
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { external } from './bundle-externals.mjs';

const root = resolve(import.meta.dirname, '..');
const FLAG = '--no-experimental-require-module';
const ENV_FILE = `--env-file=${resolve(root, '.env')}`;

// A real theme key of tark-as-salah, read from the reviewer file so the gate
// follows taxonomy edits.
const THEME_KEY = (() => {
  const source = readFileSync(resolve(root, 'prisma/taxonomy/topic-themes.yaml'), 'utf8');
  const match = /^\s*- \{\s*topic:\s*tark-as-salah\s*,\s*key:\s*([a-z0-9-]+)/m.exec(source);
  if (!match) throw new Error('gate: no tark-as-salah theme in prisma/taxonomy/topic-themes.yaml');
  return match[1];
})();

const quotesPage = (body) => body?.data?.items?.length > 0 && body?.meta?.themes?.length > 0;
const PROBES = [
  { path: '/health', want: 'status ok', expect: (body) => body?.data?.status === 'ok' },
  {
    path: '/v1/sins?limit=1&lang=ar',
    want: 'non-empty data',
    expect: (body) => Array.isArray(body?.data) && body.data.length > 0,
  },
  {
    path: '/v1/good-deeds/dhikr/quotes?limit=1&lang=ar',
    want: 'non-empty data.items and meta.themes',
    expect: quotesPage,
  },
  {
    path: `/v1/sins/tark-as-salah/quotes?limit=1&lang=ar&theme=${THEME_KEY}`,
    want: 'non-empty data.items and meta.themes',
    expect: quotesPage,
  },
];

if (process.argv[2] === '--handler-child') {
  await handlerChild(process.argv[3]);
  process.exit(0);
}

const failures = [];
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failures.push(label);
};

const prodEnv = {
  NODE_ENV: 'production',
  JWT_ACCESS_SECRET: randomBytes(24).toString('hex'),
  JWT_REFRESH_SECRET: randomBytes(24).toString('hex'),
};

await serverLeg('bundle main, require(esm) off, .env as-is', [FLAG], {});
await serverLeg('bundle main, require(esm) off, NODE_ENV=production', [FLAG], prodEnv);
await serverLeg('bundle main, require(esm) default (on)', [], {});
await handlerLeg(
  'handler',
  'serverless handler (api/index.mjs) in the repo, cwd backend/, require(esm) off, NODE_ENV=production',
  resolve(root, 'api/index.mjs'),
  root,
);
await functionTreeLeg();
await controlLeg();

console.log(failures.length ? `\nGATE FAILED (${failures.length})` : '\nGATE PASSED');
process.exit(failures.length ? 1 : 0);

async function freePort() {
  const server = createNetServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  server.close();
  await once(server, 'close');
  return port;
}

function run(args, env, cwd = root) {
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (d) => (output += d));
  child.stderr.on('data', (d) => (output += d));
  const exited = once(child, 'exit').then(([code]) => code);
  return { child, exited, output: () => output };
}

async function waitFor(url, proc, ms = 30_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (proc.child.exitCode !== null) return false;
    try {
      const res = await fetch(url);
      if (res.status > 0) return true;
    } catch {
      /* not listening yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

// Shared by the server legs (in this process) and the handler child.
async function probeAll(base) {
  const results = [];
  for (const { path, want, expect } of PROBES) {
    const res = await fetch(base + path);
    const text = await res.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      /* not JSON */
    }
    console.log(`      ${res.status} ${path} ${text.slice(0, 70).replace(/\s+/g, ' ')}…`);
    results.push({
      ok: res.status === 200 && body !== null && Boolean(expect(body)),
      label: `GET ${path} → 200, ${want}`,
    });
  }
  const head = await fetch(base + '/health', { method: 'HEAD' });
  results.push({
    ok:
      head.headers.get('x-content-type-options') === 'nosniff' &&
      head.headers.has('x-dns-prefetch-control'),
    label: 'helmet headers present',
  });
  return results;
}

async function serverLeg(label, nodeFlags, env) {
  console.log(`\n== ${label}`);
  const port = await freePort();
  const proc = run([...nodeFlags, ENV_FILE, 'dist/bundle/main.mjs'], { ...env, PORT: String(port) });
  const base = `http://127.0.0.1:${port}`;
  if (await waitFor(`${base}/health`, proc)) {
    for (const result of await probeAll(base)) check(result.ok, `${label}: ${result.label}`);
  } else {
    check(false, `${label}: server did not boot\n${proc.output().slice(-1500)}`);
  }
  proc.child.kill('SIGTERM');
  await proc.exited;
  check(!/ERR_REQUIRE_ESM/.test(proc.output()), `${label}: no ERR_REQUIRE_ESM`);
}

async function handlerLeg(tag, title, entry, cwd) {
  console.log(`\n== ${title}`);
  const proc = run([FLAG, ENV_FILE, import.meta.filename, '--handler-child', entry], prodEnv, cwd);
  const code = await proc.exited;
  const out = proc.output();
  console.log(out.split('\n').filter((l) => l.startsWith('      ') || /initialised/.test(l)).join('\n'));
  const results = out
    .split('\n')
    .filter((l) => l.startsWith('GATE-CHECK '))
    .map((l) => JSON.parse(l.slice('GATE-CHECK '.length)));
  for (const result of results) check(result.ok, `${tag}: ${result.label}`);
  const boots = (out.match(/Nest application initialised/g) ?? []).length;
  check(
    code === 0 && results.length === PROBES.length + 1,
    `${tag}: child probed every route and exited 0` +
      (code === 0 ? '' : `\n${out.split('\n').filter((l) => !l.startsWith('{"level":30')).join('\n').slice(-1500)}`),
  );
  check(boots === 1, `${tag}: Nest app created once across invocations (saw ${boots})`);
}

// Runs in a child: import the Vercel entry file and call it from http.createServer.
async function handlerChild(entry) {
  const { default: handler } = await import(pathToFileURL(entry).href);
  const server = createServer((req, res) => {
    Promise.resolve(handler(req, res)).catch((error) => {
      console.error(error);
      res.statusCode = 500;
      res.end();
    });
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const results = await probeAll(base);
  for (const result of results) console.log(`GATE-CHECK ${JSON.stringify(result)}`);
  server.close();
  // Nest keeps Prisma's pool open; the gate is done, so exit explicitly.
  process.exit(results.every((result) => result.ok) ? 0 : 1);
}

// A directory holding only what the Vercel function ships (see the header).
function stageFunctionTree() {
  const config = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8'));
  const includeFiles = [config.functions?.['api/index.mjs']?.includeFiles ?? []].flat();
  for (const pattern of includeFiles) {
    if (/[*?{}[\]!]/.test(pattern)) {
      throw new Error(`gate: includeFiles glob "${pattern}" is not supported here; extend stageFunctionTree`);
    }
  }
  const tree = mkdtempSync(join(tmpdir(), 'thekra-vercel-fn-'));
  const fnRoot = join(tree, 'backend');
  const files = ['api/index.mjs', 'dist/bundle/serverless.mjs', 'dist/bundle/serverless.mjs.map', ...includeFiles];
  for (const file of files) {
    mkdirSync(dirname(join(fnRoot, file)), { recursive: true });
    cpSync(join(root, file), join(fnRoot, file));
  }
  // pnpm layout, as Vercel ships it: backend/node_modules/<pkg> links into the
  // store, and each package resolves its own dependencies from there. The
  // uninstalled optional Nest transports are skipped (Vercel cannot ship them either).
  const linked = [];
  for (const pkg of external) {
    const source = join(root, 'node_modules', pkg);
    if (!existsSync(source)) continue;
    const target = join(fnRoot, 'node_modules', pkg);
    mkdirSync(dirname(target), { recursive: true });
    symlinkSync(realpathSync(source), target, 'dir');
    linked.push(pkg);
  }
  return { tree, files, linked };
}

async function functionTreeLeg() {
  const { tree, files, linked } = stageFunctionTree();
  try {
    console.log(`\n   function tree ${tree} (cwd): backend/{${files.join(', ')}}, node_modules: ${linked.join(', ')}`);
    await handlerLeg(
      'function tree',
      'serverless handler in a replica of the Vercel function tree, cwd = tree root, require(esm) off, NODE_ENV=production',
      join(tree, 'backend', 'api', 'index.mjs'),
      tree,
    );
  } finally {
    rmSync(tree, { recursive: true, force: true });
  }
}

async function controlLeg() {
  console.log('\n== negative control: un-bundled dist/main.js, require(esm) off (must fail)');
  const port = await freePort();
  const proc = run([FLAG, ENV_FILE, 'dist/main.js'], { PORT: String(port) });
  await waitFor(`http://127.0.0.1:${port}/health`, proc, 15_000);
  if (proc.child.exitCode === null) proc.child.kill('SIGTERM');
  await proc.exited;
  const reproduced = /ERR_REQUIRE_ESM/.test(proc.output());
  const line = proc.output().split('\n').find((l) => /ERR_REQUIRE_ESM/.test(l)) ?? '';
  console.log(`      ${line.slice(0, 160)}`);
  check(reproduced, 'control: dist/main.js reproduces ERR_REQUIRE_ESM under the flag');
}
