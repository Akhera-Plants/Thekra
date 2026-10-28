/**
 * Toolbar/store icons (16, 32, 48, 128 px) from assets/icon.svg (a copy of frontend/src/app/icon.svg).
 *
 * Converters tried in order:
 *   1. `rsvg-convert` on PATH;
 *   2. Playwright's Chromium (`playwright` resolvable from here, from $PLAYWRIGHT_MODULE, or from `npm root -g`):
 *      the SVG is drawn at each size and screenshotted with a transparent background.
 * When neither exists, build.mjs copies the committed PNGs in assets/icons/ (made by this script).
 * ImageMagick is not used: without librsvg it cannot read SVG.
 *
 * Run `node scripts/icons.mjs` to refresh assets/icons/ after the logo changes.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
export const ICON_SVG = resolve(root, 'assets/icon.svg');
export const COMMITTED_ICONS = resolve(root, 'assets/icons');
export const SIZES = [16, 32, 48, 128];

function hasCommand(cmd) {
  try {
    execFileSync('sh', ['-c', `command -v ${cmd}`], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    // not a dependency of the extension; look elsewhere
  }
  const candidates = [];
  if (process.env.PLAYWRIGHT_MODULE) candidates.push(process.env.PLAYWRIGHT_MODULE);
  try {
    const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    candidates.push(join(globalRoot, 'playwright'));
  } catch {
    // npm missing
  }
  for (const c of candidates) {
    try {
      const require = createRequire(pathToFileURL(join(resolve(c), 'package.json')));
      const entry = existsSync(join(resolve(c), 'package.json')) ? require.resolve(resolve(c)) : resolve(c);
      return await import(pathToFileURL(entry).href);
    } catch {
      // try the next one
    }
  }
  return null;
}

/**
 * Writes icon-<size>.png into `outDir`. Returns the converter used, or `null` when none is available.
 * @param {string} outDir
 * @returns {Promise<string | null>}
 */
export async function generateIcons(outDir) {
  mkdirSync(outDir, { recursive: true });
  if (hasCommand('rsvg-convert')) {
    for (const size of SIZES) {
      execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), '-o', join(outDir, `icon-${size}.png`), ICON_SVG]);
    }
    return 'rsvg-convert';
  }
  const pw = await loadPlaywright();
  const chromium = pw?.chromium ?? pw?.default?.chromium;
  if (!chromium) return null;
  let browser;
  try {
    browser = await chromium.launch();
  } catch {
    return null;
  }
  try {
    const svg = readFileSync(ICON_SVG, 'utf8');
    for (const size of SIZES) {
      const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
      const sized = svg.replace('<svg ', `<svg width="${size}" height="${size}" `);
      await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${sized}</body></html>`);
      await page.screenshot({ path: join(outDir, `icon-${size}.png`), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
      await page.close();
    }
    return 'playwright-chromium';
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const method = await generateIcons(COMMITTED_ICONS);
  if (!method) {
    console.error('icons: no SVG converter found (rsvg-convert or Playwright Chromium)');
    process.exit(1);
  }
  console.log(`icons: ${SIZES.join(', ')} px written to assets/icons with ${method}`);
}
