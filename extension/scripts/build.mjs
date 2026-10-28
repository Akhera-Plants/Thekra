/**
 * Builds dist/chrome and dist/firefox (and a .zip of each when `zip` is on PATH).
 *
 *   1. src/generated/catalog.json from deed-schedules.yaml (scripts/gen-catalog.mjs);
 *   2. esbuild bundles (ESM, unminified so store reviewers can read them) of the service worker and the popup,
 *      with @thekra/practice-core and the catalog inlined; targets chrome114 / firefox121;
 *   3. static files: popup.html/css, _locales, icons (rendered from assets/icon.svg when a converter exists,
 *      else the committed PNGs), and the manifest for each browser.
 *
 * Run: pnpm --filter thekra-extension build
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { CATALOG_OUT, generateCatalog } from './gen-catalog.mjs';
import { COMMITTED_ICONS, generateIcons } from './icons.mjs';
import { buildManifest } from './manifest.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const TARGETS = /** @type {const} */ ({ chrome: 'chrome114', firefox: 'firefox121' });

function hasZip() {
  try {
    execFileSync('sh', ['-c', 'command -v zip'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const catalog = await generateCatalog();
console.log(`catalog: ${catalog.count} habits from ${catalog.source}`);
const bundledCatalog = readFileSync(CATALOG_OUT, 'utf8');

rmSync(dist, { recursive: true, force: true });

// Icons once, copied into each target.
const iconsTmp = join(dist, '.icons');
const iconMethod = await generateIcons(iconsTmp);
const iconSource = iconMethod ? iconsTmp : COMMITTED_ICONS;
console.log(`icons: ${iconMethod ? `rendered with ${iconMethod}` : 'no converter found, copied assets/icons'}`);

for (const [target, esTarget] of Object.entries(TARGETS)) {
  const out = join(dist, target);
  mkdirSync(out, { recursive: true });
  const result = await build({
    entryPoints: { background: join(root, 'src/background.ts'), popup: join(root, 'src/popup/popup.ts') },
    outdir: out,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: esTarget,
    minify: false,
    sourcemap: false,
    legalComments: 'none',
    charset: 'utf8',
    define: {
      __TARGET__: JSON.stringify(target),
      __BUNDLED_CATALOG__: bundledCatalog.trim(),
    },
    logLevel: 'warning',
    metafile: true,
  });
  if (result.warnings.length > 0) throw new Error(`esbuild warnings for ${target}`);

  cpSync(join(root, 'src/popup/popup.html'), join(out, 'popup.html'));
  cpSync(join(root, 'src/popup/popup.css'), join(out, 'popup.css'));
  cpSync(join(root, '_locales'), join(out, '_locales'), { recursive: true });
  cpSync(iconSource, join(out, 'icons'), { recursive: true });
  writeFileSync(join(out, 'manifest.json'), `${JSON.stringify(buildManifest(/** @type {any} */ (target), pkg.version), null, 2)}\n`);
  console.log(`${target}: ${readdirSync(out).sort().join(', ')}`);
}
rmSync(iconsTmp, { recursive: true, force: true });
if (!existsSync(join(dist, 'chrome', 'background.js'))) throw new Error('build failed: no background.js');

// The Firefox background runs as a classic script: the bundle must not contain module syntax.
const ffBackground = readFileSync(join(dist, 'firefox', 'background.js'), 'utf8');
if (/^(import|export)\s/m.test(ffBackground) || ffBackground.includes('import.meta')) {
  throw new Error('dist/firefox/background.js contains module syntax');
}

if (hasZip()) {
  for (const target of Object.keys(TARGETS)) {
    const zipName = `thekra-${target}-${pkg.version}.zip`;
    execFileSync('zip', ['-qr', '-X', join('..', zipName), '.'], { cwd: join(dist, target) });
    console.log(`zip: dist/${zipName}`);
  }
} else {
  console.log('zip: not found on PATH, skipped');
}
