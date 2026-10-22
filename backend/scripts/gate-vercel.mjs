// Local gate that stands in for Vercel's function loader.
//
// Vercel's loader (/opt/rust/nodejs.js) disables require(esm); Node >= 22.12
// enables it by default, which hides ERR_REQUIRE_ESM locally. Every leg below
// therefore runs with `node --no-experimental-require-module`.
//
//   pnpm --filter backend gate:vercel      (builds first, needs the .env DB)
//
// Legs: bundled server (dev env, prod env, and without the flag), the
// serverless handler called twice through a plain http server, and a negative
// control proving the un-bundled dist/main.js still fails the way Vercel did.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const FLAG = '--no-experimental-require-module';
const PATHS = [
  '/health',
  '/v1/sins?limit=1&lang=ar',
  '/v1/good-deeds/dhikr/quotes?limit=1&lang=ar',
];

if (process.argv[2] === '--handler-child') {
  await handlerChild();
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
await handlerLeg();
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

function run(args, env) {
  const child = spawn(process.execPath, args, {
    cwd: root,
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

async function probe(base, label) {
  for (const path of PATHS) {
    const res = await fetch(base + path);
    const body = await res.text();
    console.log(`      ${res.status} ${path} ${body.slice(0, 70).replace(/\s+/g, ' ')}…`);
    check(res.status === 200 && body.startsWith('{'), `${label}: GET ${path} → 200 JSON`);
  }
  const head = await fetch(base + '/health', { method: 'HEAD' });
  check(
    head.headers.get('x-content-type-options') === 'nosniff' &&
      head.headers.has('x-dns-prefetch-control'),
    `${label}: helmet headers present`,
  );
}

async function serverLeg(label, nodeFlags, env) {
  console.log(`\n== ${label}`);
  const port = await freePort();
  const proc = run(
    [...nodeFlags, '--env-file=.env', 'dist/bundle/main.mjs'],
    { ...env, PORT: String(port) },
  );
  const base = `http://127.0.0.1:${port}`;
  if (await waitFor(`${base}/health`, proc)) {
    await probe(base, label);
  } else {
    check(false, `${label}: server did not boot\n${proc.output().slice(-1500)}`);
  }
  proc.child.kill('SIGTERM');
  await proc.exited;
  check(!/ERR_REQUIRE_ESM/.test(proc.output()), `${label}: no ERR_REQUIRE_ESM`);
}

async function handlerLeg() {
  console.log('\n== serverless handler (api/index.mjs), require(esm) off, NODE_ENV=production');
  const proc = run([FLAG, '--env-file=.env', import.meta.filename, '--handler-child'], prodEnv);
  const code = await proc.exited;
  const out = proc.output();
  console.log(out.split('\n').filter((l) => l.startsWith('      ') || /initialised/.test(l)).join('\n'));
  const boots = (out.match(/Nest application initialised/g) ?? []).length;
  check(code === 0, 'handler: child exited 0');
  check(boots === 1, `handler: Nest app created once across invocations (saw ${boots})`);
}

// Runs in a child: import the Vercel entry file and call it from http.createServer.
async function handlerChild() {
  const { default: handler } = await import(pathToFileURL(resolve(root, 'api/index.mjs')).href);
  const server = createServer((req, res) => {
    Promise.resolve(handler(req, res)).catch((error) => {
      console.error(error);
      res.statusCode = 500;
      res.end();
    });
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  let bad = 0;
  for (const path of [...PATHS, '/health']) {
    const res = await fetch(base + path);
    const body = await res.text();
    console.log(`      ${res.status} ${path} ${body.slice(0, 70).replace(/\s+/g, ' ')}…`);
    if (res.status !== 200 || !body.startsWith('{')) bad++;
  }
  const head = await fetch(base + '/health', { method: 'HEAD' });
  if (head.headers.get('x-content-type-options') !== 'nosniff') bad++;
  server.close();
  process.exitCode = bad ? 1 : 0;
  // Nest keeps Prisma's pool open; the gate is done, so exit explicitly.
  process.exit(process.exitCode);
}

async function controlLeg() {
  console.log('\n== negative control: un-bundled dist/main.js, require(esm) off (must fail)');
  const port = await freePort();
  const proc = run([FLAG, '--env-file=.env', 'dist/main.js'], { PORT: String(port) });
  await waitFor(`http://127.0.0.1:${port}/health`, proc, 15_000);
  if (proc.child.exitCode === null) proc.child.kill('SIGTERM');
  await proc.exited;
  const reproduced = /ERR_REQUIRE_ESM/.test(proc.output());
  const line = proc.output().split('\n').find((l) => /ERR_REQUIRE_ESM/.test(l)) ?? '';
  console.log(`      ${line.slice(0, 160)}`);
  check(reproduced, 'control: dist/main.js reproduces ERR_REQUIRE_ESM under the flag');
}
