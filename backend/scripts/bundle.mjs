// Bundles the tsc output in dist/ (it carries the decorator metadata Nest DI
// needs) into self-contained ESM files under dist/bundle/.
//
// Why: @nestjs/common & friends 12.x are ESM-only, while @nestjs/throttler 6.7.1
// and nestjs-pino 5.3.1 are CommonJS and require() them. That only works when
// Node's require(esm) is on (Node >= 22.12 by default); Vercel's function loader
// turns it off. A bundler links CJS and ESM at build time, so no runtime
// require() of an ES module is left. See docs/deploy/VERCEL.md.
//
// Run after `nest build` (the `build` script does both). scripts/dev.mjs imports
// `bundleOptions` for local development with watch and restart.
import { build } from 'esbuild';
import { readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { external } from './bundle-externals.mjs';

const root = resolve(import.meta.dirname, '..');
export const outdir = resolve(root, 'dist/bundle');

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

// src/modules/taxonomy/taxonomy-files.ts reads prisma/taxonomy/*.yaml from
// disk. The Vercel function ships only the bundle (and vercel.json
// includeFiles), so embed the text: replace the module with one that has the
// same exports and returns the files' content. The file list and the reading
// come from the compiled module itself, so there is one source of truth.
const EMBED_EXPORTS = ['TAXONOMY_FILES', 'readTaxonomyFile', 'taxonomyFilePath'];
let embeddedTaxonomy = null;
const embedTaxonomy = {
  name: 'embed-taxonomy',
  setup(b) {
    b.onLoad({ filter: /[\\/]modules[\\/]taxonomy[\\/]taxonomy-files\.js$/ }, async (args) => {
      const mod = await import(pathToFileURL(args.path).href);
      const exported = Object.keys(mod).sort();
      if (exported.join() !== [...EMBED_EXPORTS].sort().join()) {
        throw new Error(
          `embed-taxonomy: ${args.path} exports [${exported}], the plugin generates [${EMBED_EXPORTS}]; update scripts/bundle.mjs`,
        );
      }
      const files = Object.fromEntries(mod.TAXONOMY_FILES.map((file) => [file, mod.readTaxonomyFile(file)]));
      embeddedTaxonomy = Object.keys(files);
      return {
        contents: [
          `const EMBEDDED = ${JSON.stringify(files)};`,
          `export const TAXONOMY_FILES = ${JSON.stringify(mod.TAXONOMY_FILES)};`,
          'export function taxonomyFilePath(file) {',
          '  throw new Error(`prisma/taxonomy/${file} is embedded in the bundle and has no path on disk`);',
          '}',
          'export function readTaxonomyFile(file) {',
          '  if (!Object.hasOwn(EMBEDDED, file)) throw new Error(`prisma/taxonomy/${file} is not embedded in the bundle`);',
          '  return EMBEDDED[file];',
          '}',
        ].join('\n'),
        loader: 'js',
        watchFiles: mod.TAXONOMY_FILES.map((file) => mod.taxonomyFilePath(file)),
      };
    });
  },
};

/** The esbuild options of the server bundles (build here, watch in scripts/dev.mjs). */
export function bundleOptions() {
  return {
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
    plugins: [staticHelmet, embedTaxonomy],
    // Bundled CommonJS code calls require() for externals; ESM has no `require`.
    banner: {
      js: [
        "import { createRequire as __bundleCreateRequire } from 'node:module';",
        'globalThis.require ??= __bundleCreateRequire(import.meta.url);',
      ].join('\n'),
    },
    logLevel: 'info',
  };
}

/**
 * A renamed or moved taxonomy-files module would otherwise be bundled as is,
 * with its disk reads, and fail only on Vercel. Returns the embedded file names.
 */
export function assertTaxonomyEmbedded() {
  if (!embeddedTaxonomy) {
    throw new Error('embed-taxonomy: dist/modules/taxonomy/taxonomy-files.js was not bundled; update scripts/bundle.mjs');
  }
  return embeddedTaxonomy;
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  rmSync(outdir, { recursive: true, force: true });
  await build(bundleOptions());
  console.log(`embed-taxonomy: inlined prisma/taxonomy/{${assertTaxonomyEmbedded().join(',')}}`);
}
