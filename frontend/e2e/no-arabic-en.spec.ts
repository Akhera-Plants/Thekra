import { expect, test, type Page } from '@playwright/test';
import { arabicLeaks } from '../src/lib/format/arabic-leak';

/**
 * Visible text on /en that is not inside lang="ar".
 * Quran/hadith originals and the Arabic brand may appear only inside lang="ar".
 */
async function englishCopyOutsideArabic(page: Page): Promise<string> {
  return page.evaluate(() => {
    const root = document.body;
    const chunks: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const parent = node.parentElement;
      if (!parent) {
        node = walker.nextNode();
        continue;
      }
      const hidden = parent.closest(
        'nextjs-portal, [data-nextjs-toast], [data-nextjs-dev-tools-button], [data-locale-switch], script, style, noscript',
      );
      const arabicScope = parent.closest('[lang="ar"]');
      const text = node.textContent ?? '';
      if (!hidden && !arabicScope && text.trim()) chunks.push(text);
      node = walker.nextNode();
    }
    for (const element of root.querySelectorAll('[aria-label], [placeholder], [alt], [title]')) {
      if (element.closest('[lang="ar"], [data-locale-switch]')) continue;
      for (const name of ['aria-label', 'placeholder', 'alt', 'title'] as const) {
        const value = element.getAttribute(name);
        if (value?.trim()) chunks.push(value);
      }
    }
    return chunks.join('\n');
  });
}

/**
 * Page chrome around a topic: breadcrumbs and the page heading (title, lead lines, rank,
 * branches). No Arabic here at all, not even marked lang="ar": the English view shows the
 * English name and description or nothing (no Arabic subtitle, no Arabic fallback prose).
 */
async function arabicInChrome(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const ARABIC = /[\u0600-\u06FF]/;
    const found: string[] = [];
    for (const scope of document.querySelectorAll('nav.breadcrumbs, header.page-heading')) {
      const text = scope.textContent ?? '';
      if (ARABIC.test(text)) found.push(text.replace(/\s+/g, ' ').trim().slice(0, 120));
    }
    return found;
  });
}

async function expectNoArabicLeak(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'networkidle' });
  const leaks = arabicLeaks(await englishCopyOutsideArabic(page));
  expect(leaks, `${path}: ${leaks.slice(0, 8).join(' | ')}`).toEqual([]);
  const chrome = await arabicInChrome(page);
  expect(chrome, `${path} breadcrumbs/heading`).toEqual([]);
}

test.use({ locale: 'en' });

test('English pages keep Arabic script inside lang="ar"', async ({ page }) => {
  for (const path of ['/en', '/en/sins', '/en/sins/ghibah', '/en/good-deeds', '/en/branches']) {
    await expectNoArabicLeak(page, path);
  }
});

test('English topic pages (sin, deed, pair, branch, quote) have no Arabic chrome', async ({ page }) => {
  // A sin, a good deed, both sides of a sin/deed pair, and a branch of faith.
  for (const path of [
    '/en/sins/ghibah',
    '/en/good-deeds/silat-ar-rahim',
    '/en/sins/tark-as-salah',
    '/en/good-deeds/salah',
    '/en/branches/1',
    '/en/about',
  ]) {
    await expectNoArabicLeak(page, path);
  }

  // The quote page's last crumb is an excerpt in the page language, not the Arabic text.
  const today = await page.request.get('http://127.0.0.1:3001/v1/quotes/today?lang=en');
  const body = (await today.json()) as { data?: { id?: string } | null };
  if (body.data?.id) await expectNoArabicLeak(page, `/en/quotes/${body.data.id}`);
});
