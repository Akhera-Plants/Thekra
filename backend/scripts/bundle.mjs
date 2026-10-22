// Bundles the tsc output in dist/ (it carries the decorator metadata Nest DI
// needs) into self-contained ESM files under dist/bundle/.
//
// Why: @nestjs/common & friends 12.x are ESM-only, while @nestjs/throttler 6.7.1
// and nestjs-pino 5.3.1 are CommonJS and require() them. That only works when
// Node's require(esm) is on (Node >= 22.12 by default); Vercel's function loader
// turns it off. A bundler links CJS and ESM at build time, so no runtime
// require() of an ES module is left. See docs/deploy/VERCEL.md.
//
// Run after `nest build` (the `build` script does both).
import { build } from 'esbuild';
import { readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const outdir = resolve(root, 'dist/bundle');

// Packages that must stay on disk: native bindings, files read relative to the
// package (pino's thread-stream worker transports), or the generated Prisma
// client (lives in node_modules/.prisma).
// Vercel's file tracing ships whatever these import. Optional Nest transports
// are not installed; Nest only imports them when a microservice/websocket
// feature is used, which this app never does.
export const external = [
  'argon2',
  '@prisma/client',
  '.prisma/client',
  'pino-http',
  '@nestjs/microservices',
  '@nestjs/websockets',
  '@nestjs/platform-socket.io',
  '@nestjs/platform-ws',
];

// src/config/configure-app.ts loads helmet through createRequire() (a typing
// workaround, see its comment). A bundler and Vercel's file tracer cannot see
// that call, so helmet would be neither bundled nor shipped. Turn the call into
// a plain import at bundle time; the runtime value is the same function.
const staticHelmet = {
  name: 'static-helmet',
  setup(b) {
    b.onLoad({ filter: /[\\/]config[\\/]configure-app\.js$/ }, (args) => {
      const source = readFileSync(args.path, 'utf8');
      const call = /\brequire\(\s*(['"])helmet\1\s*\)/;
      if (!call.test(source)) return undefined;
      return {
        contents: `import __helmet from 'helmet';\n${source.replace(call, '__helmet')}`,
        loader: 'js',
        resolveDir: dirname(args.path),
      };
    });
  },
};

rmSync(outdir, { recursive: true, force: true });

await build({
  entryPoints: {
    main: resolve(root, 'dist/main.js'),
    serverless: resolve(root, 'dist/serverless.js'),
  },
  outdir,
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  sourcesContent: false,
  // Keep class and function names: Nest uses them for DI tokens, route and
  // log context, and Prisma/class-validator for metadata.
  keepNames: true,
  minify: false,
  external,
  plugins: [staticHelmet],
  // Bundled CommonJS code calls require() for externals; ESM has no `require`.
  banner: {
    js: [
      "import { createRequire as __bundleCreateRequire } from 'node:module';",
      'globalThis.require ??= __bundleCreateRequire(import.meta.url);',
    ].join('\n'),
  },
  logLevel: 'info',
});
