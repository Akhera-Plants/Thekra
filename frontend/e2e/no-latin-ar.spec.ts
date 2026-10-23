import { expect, test, type Page } from '@playwright/test';
import { latinLeaks } from '../src/lib/format/latin-leak';

async function visibleCopy(page: Page): Promise<string> {
  return page.evaluate(() => {
    const root = document.body;
    const chunks: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const parent = node.parentElement;
      const hidden =
        parent?.closest(
          'nextjs-portal, [data-nextjs-toast], [data-nextjs-dev-tools-button], [data-locale-switch], script, style',
        );
      const text = node.textContent ?? '';
      if (!hidden && text.trim() && text.trim() !== 'English') chunks.push(text);
      node = walker.nextNode();
    }
    for (const element of root.querySelectorAll('[aria-label], [placeholder], [alt], [title]')) {
      if (element.closest('[data-locale-switch]')) continue;
      for (const name of ['aria-label', 'placeholder', 'alt', 'title'] as const) {
        const value = element.getAttribute(name);
        if (value && value.trim() !== 'English') chunks.push(value);
      }
    }
    return chunks.join('\n');
  });
}

async function expectArabic(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'networkidle' });
  const leaks = latinLeaks(await visibleCopy(page));
  expect(leaks, `${path}: ${leaks.join(', ')}`).toEqual([]);
}

test('Arabic pages contain no Latin letters except the language switch', async ({ page }) => {
  await expectArabic(page, '/');
  await expectArabic(page, '/sins');
  // Client-side navigations: wait for the new URL, not just an idle network (the old page
  // is already idle, so a bare networkidle wait could read the list page again).
  const sin = page.locator('a[href*="/sins/"]').first();
  await sin.click();
  await page.waitForURL(/\/sins\/[^/?#]+/);
  await page.waitForLoadState('networkidle');
  expect(latinLeaks(await visibleCopy(page)), page.url()).toEqual([]);

  const quote = page.locator('a[href*="/quotes/"]').first();
  if (await quote.count()) {
    await quote.click();
    await page.waitForURL(/\/quotes\//);
    await page.waitForLoadState('networkidle');
    expect(latinLeaks(await visibleCopy(page)), page.url()).toEqual([]);
  }

  await expectArabic(page, '/good-deeds');
  const deed = page.locator('a[href*="/good-deeds/"]').first();
  await deed.click();
  await page.waitForURL(/\/good-deeds\/[^/?#]+/);
  await page.waitForLoadState('networkidle');
  expect(latinLeaks(await visibleCopy(page)), page.url()).toEqual([]);

  await expectArabic(page, '/branches');
  await expectArabic(page, '/branches/1');
  await expectArabic(page, '/about');

  const today = await page.request.get('http://127.0.0.1:3001/v1/quotes/today?lang=ar');
  const body = (await today.json()) as { data?: { id?: string } | null };
  if (body.data?.id) await expectArabic(page, `/quotes/${body.data.id}`);

  // Current header has no separate «القائمة» drawer — chrome is inline (handoff).
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(latinLeaks(await visibleCopy(page)), 'mobile header').toEqual([]);
  await expect(page.locator('[data-locale-switch]').last()).toHaveText('En');
});

test('Arabic topic pages (sin, deed, pair, branch) contain no Latin letters', async ({ page }) => {
  for (const path of [
    '/sins/ghibah',
    '/good-deeds/silat-ar-rahim',
    '/sins/tark-as-salah',
    '/good-deeds/salah',
    '/branches/1',
  ]) {
    await expectArabic(page, path);
  }
});
