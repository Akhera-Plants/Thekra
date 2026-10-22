/**
 * Theme chips on a topic page and theme hits in the catalogue search.
 * Uses http://localhost:3000 so the client fetch to localhost:3001 passes CORS
 * (see athar-badge.spec.ts). Needs the API with `pnpm import:taxonomy` applied.
 */
import { expect, test } from '@playwright/test';

const PAGE = 'http://localhost:3000/sins/tark-as-salah';

test('a chip filters the list, shows its count, syncs ?theme= and «الكل» clears it', async ({ page }) => {
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  const chips = page.getByRole('group', { name: 'موضوعات الباب' });
  await expect(chips.getByRole('button', { name: 'الكل' })).toHaveAttribute('aria-pressed', 'true');

  const jumua = chips.getByRole('button', { name: /ترك الجمعة/ });
  const count = Number((await jumua.locator('span').last().innerText()).replace(/[^\d٠-٩]/g, '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))));
  await jumua.click();
  await expect(jumua).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/[?&]theme=tark-jumua\b/);
  await expect(page.locator('article[aria-labelledby]')).toHaveCount(count);

  await chips.getByRole('button', { name: 'الكل' }).press('Enter');
  await expect(page).not.toHaveURL(/theme=/);
  await expect(chips.getByRole('button', { name: 'الكل' })).toHaveAttribute('aria-pressed', 'true');
});

test('?theme= in the URL opens the page with that chip on; English shows English labels', async ({ page }) => {
  await page.goto(`${PAGE}?theme=tark-jamaah`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('group', { name: 'موضوعات الباب' }).getByRole('button', { name: /ترك الجماعة/ })).toHaveAttribute('aria-pressed', 'true');

  await page.goto('http://localhost:3000/en/sins/tark-as-salah?theme=tark-jumua', { waitUntil: 'networkidle' });
  const chip = page.getByRole('group', { name: 'Themes on this page' }).getByRole('button', { name: /Missing Friday prayer/ });
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
});

test('searching «عقوبة تارك الصلاة» finds the theme and opens it preselected', async ({ page }) => {
  await page.goto('http://localhost:3000/sins', { waitUntil: 'networkidle' });
  await page.getByRole('searchbox').fill('عقوبة تارك الصلاة');
  const hit = page.locator('a.topic-item', { hasText: 'عقوبة تارك الصلاة' });
  await expect(hit).toHaveAttribute('href', /\/sins\/tark-as-salah\?theme=tark-salah-iqab$/);
  await hit.click();
  await expect(page).toHaveURL(/theme=tark-salah-iqab/);
  await expect(page.getByRole('group', { name: 'موضوعات الباب' }).getByRole('button', { name: /عقوبة تارك الصلاة/ })).toHaveAttribute('aria-pressed', 'true');
});

test('topic search still finds topics by name', async ({ page }) => {
  // riba is not paired, so the catalogue lists it under its own name.
  await page.goto('http://localhost:3000/sins?q=' + encodeURIComponent('الربا'), { waitUntil: 'networkidle' });
  await expect(page.locator('a.topic-item[href$="/sins/riba"]')).toBeVisible();
});
