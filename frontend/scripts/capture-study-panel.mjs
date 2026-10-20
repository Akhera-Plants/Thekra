/**
 * Capture study-panel screenshots (verse + hadith × ar/en × light/dark × 1440/390).
 * Run from frontend: pnpm exec node scripts/capture-study-panel.mjs
 */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../../docs/design/after/study');
const BASE = process.env.STUDY_CAPTURE_BASE ?? 'http://localhost:3000';
const VERSE = '2f2d4948-a9b9-4dec-af4b-5f60a7b9d5fe';
const HADITH = '7cc2fee7-9124-4630-9159-40dc948e538e';

const sizes = [
  { name: '1440', width: 1440, height: 900 },
  { name: '390', width: 390, height: 844 },
];
const themes = ['light', 'dark'];
const locales = ['ar', 'en'];
const subjects = [
  { kind: 'verse', id: VERSE, openLabel: /التفسير|Tafsir/i },
  { kind: 'hadith', id: HADITH, openLabel: /الشرح|Commentary/i },
];

async function setTheme(page, theme) {
  await page.evaluate((mode) => {
    const root = document.documentElement;
    if (mode === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    try {
      localStorage.setItem('theme', mode);
    } catch {
      /* ignore */
    }
  }, theme);
}

async function openStudy(page, openLabel) {
  const btn = page.getByRole('button', { name: openLabel }).first();
  await btn.waitFor({ state: 'visible', timeout: 15000 });
  await btn.click();
  await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForFunction(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return false;
    const text = dialog.innerText || '';
    return !/جارٍ التحميل|Loading/i.test(text) && text.length > 40;
  }, { timeout: 20000 });
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  for (const subject of subjects) {
    for (const locale of locales) {
      for (const theme of themes) {
        for (const size of sizes) {
          await page.setViewportSize({ width: size.width, height: size.height });
          const url = `${BASE}/${locale}/quotes/${subject.id}`;
          await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
          await setTheme(page, theme);
          await page.waitForTimeout(300);
          await setTheme(page, theme);
          // Hide Next.js dev overlays in documentation shots
          await page.addStyleTag({
            content: 'nextjs-portal, [data-nextjs-toast], [data-nextjs-dialog-overlay] { display: none !important; }',
          });
          await openStudy(page, subject.openLabel);
          const file = path.join(
            OUT,
            `${subject.kind}-${theme}-${size.name}-${locale}.png`,
          );
          await page.screenshot({ path: file, fullPage: false });
          console.log('wrote', path.basename(file));
        }
      }
    }
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
