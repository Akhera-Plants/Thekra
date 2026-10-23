/**
 * Regressions from the 2026-10-23 site audit (docs/review/2026-10-23-audit-fixes.md).
 * Needs the web app and the API with the release data, e.g.
 *   PLAYWRIGHT_BASE_URL=http://localhost:3002 pnpm --filter frontend test:ar e2e/audit-regressions.spec.ts
 * (the API must allow the web origin in CORS_ORIGINS).
 */
import { expect, test, type Page } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
/** frontend/src/lib/reading.ts TOPIC_PAGE_SIZE: a list shows this many before «عرض المزيد». */
const PAGE = 20;

const toNumber = (text: string) =>
  Number(text.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, ''));

async function cards(page: Page) {
  return page.locator('article[aria-labelledby]');
}

test('B02: the sins index and a sin page carry the sin, not its virtue', async ({ page }) => {
  await page.goto(`${BASE}/sins`, { waitUntil: 'networkidle' });
  for (const [slug, sin, virtue] of [
    ['riya', 'الرياء', 'الإخلاص'],
    ['kibr', 'الكبر', 'التواضع'],
    ['uquq', 'عقوق الوالدين', 'بر الوالدين'],
  ] as const) {
    const item = page.locator(`a.topic-item[href$="/sins/${slug}"]`);
    await expect(item).toContainText(sin);
    await expect(item).not.toContainText(virtue);
  }
  await page.goto(`${BASE}/sins/riya`, { waitUntil: 'networkidle' });
  await expect(page.locator('h1')).toHaveText('الرياء');
  await expect(page.locator('.page-heading')).toContainText('الفضيلة المقابلة: الإخلاص');
});

test('B08: the catalogue search ignores tashkeel', async ({ page }) => {
  for (const query of ['غض البصر', 'غضّ البصر']) {
    // `load`, not `networkidle`: the catalogue keeps prefetching topic pages; the assertion waits.
    await page.goto(`${BASE}/sins?q=${encodeURIComponent(query)}`, { waitUntil: 'load' });
    await expect(page.locator('a.topic-item[href$="/sins/nazar-muharram"]')).toBeVisible();
  }
});

test('B07: a shared ?theme= link opens on that theme; chips and back/forward stay in sync', async ({ page }) => {
  const chips = page.getByRole('group', { name: 'موضوعات الباب' });
  await page.goto(`${BASE}/sins/ghibah?theme=lisan-ghibah`, { waitUntil: 'networkidle' });
  const nahy = chips.getByRole('button', { name: /النهي عن الغيبة/ });
  await expect(nahy).toHaveAttribute('aria-pressed', 'true');
  await expect(await cards(page)).toHaveCount(Math.min(PAGE, toNumber(await nahy.locator('span').last().innerText())));

  const tahrim = chips.getByRole('button', { name: /تحريم الغيبة/ });
  await tahrim.click();
  await expect(page).toHaveURL(/theme=ghibah-tahrim/);
  await expect(tahrim).toHaveAttribute('aria-pressed', 'true');
  await expect(await cards(page)).toHaveCount(Math.min(PAGE, toNumber(await tahrim.locator('span').last().innerText())));

  await page.goBack();
  await expect(page).toHaveURL(/theme=lisan-ghibah/);
  await expect(nahy).toHaveAttribute('aria-pressed', 'true');
  await expect(await cards(page)).toHaveCount(Math.min(PAGE, toNumber(await nahy.locator('span').last().innerText())));
});

test('B06: every kind tab shows exactly its count', async ({ page }) => {
  await page.goto(`${BASE}/branches/1`, { waitUntil: 'networkidle' });
  const tabs = page.getByRole('tab');
  const count = await tabs.count();
  expect(count).toBeGreaterThan(1);
  for (let index = 0; index < count; index += 1) {
    const tab = tabs.nth(index);
    const expected = toNumber(await tab.innerText());
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await expect(await cards(page)).toHaveCount(Math.min(PAGE, expected));
  }
});

test('B09: switching language keeps the theme and the search', async ({ page }) => {
  await page.goto(`${BASE}/sins/ghibah?theme=lisan-ghibah`, { waitUntil: 'networkidle' });
  await page.locator('[data-locale-switch]').click();
  await expect(page).toHaveURL(/\/en\/sins\/ghibah\?theme=lisan-ghibah$/);
  await expect(
    page.getByRole('group', { name: 'Themes on this page' }).getByRole('button', { pressed: true }),
  ).not.toHaveText(/^All/);

  await page.goto(`${BASE}/sins?q=${encodeURIComponent('الغيبة')}`, { waitUntil: 'networkidle' });
  await page.locator('[data-locale-switch]').click();
  await expect(page).toHaveURL(/\/en\/sins\?q=/);
  await expect(page.getByRole('searchbox')).toHaveValue('الغيبة');
});

test('Paging: a long topic shows 20 texts, then «المزيد» adds the next 20', async ({ page }) => {
  await page.goto(`${BASE}/good-deeds/dhikr`, { waitUntil: 'load' });
  const more = page.getByRole('button', { name: 'عرض المزيد' });
  await expect(page.locator('article[aria-labelledby]')).toHaveCount(20);
  await more.click();
  await expect(page.locator('article[aria-labelledby]')).toHaveCount(40);
  await expect(more).toBeVisible();
});

test('Paging: a theme with 33 texts shows 20, then the remaining 13, then no button', async ({ page }) => {
  await page.goto(`${BASE}/sins/ghibah?theme=ghibah-tahrim`, { waitUntil: 'load' });
  const chip = page.getByRole('group', { name: 'موضوعات الباب' }).getByRole('button', { name: /تحريم الغيبة/ });
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  const total = toNumber(await chip.locator('span').last().innerText());
  await expect(page.locator('article[aria-labelledby]')).toHaveCount(Math.min(PAGE, total));
  await page.getByRole('button', { name: 'عرض المزيد' }).click();
  await expect(page.locator('article[aria-labelledby]')).toHaveCount(total);
  await expect(page.getByRole('button', { name: 'عرض المزيد' })).toHaveCount(0);
});

test('PWA: manifest, icons and an offline page are served', async ({ request }) => {
  const manifest = await (await request.get(`${BASE}/manifest.webmanifest`)).json();
  expect(manifest).toMatchObject({ start_url: '/', display: 'standalone', lang: 'ar', dir: 'rtl' });
  for (const icon of manifest.icons as Array<{ src: string }>) {
    expect((await request.get(`${BASE}${icon.src}`)).status()).toBe(200);
  }
  const sw = await request.get(`${BASE}/sw.js`);
  expect(sw.status()).toBe(200);
  expect(sw.headers()['cache-control']).toContain('no-cache');
  expect((await request.get(`${BASE}/offline`)).status()).toBe(200);
  expect(await (await request.get(`${BASE}/robots.txt`)).text()).toContain('Sitemap:');
  expect(await (await request.get(`${BASE}/sitemap.xml`)).text()).toContain('/sins/ghibah');
});
