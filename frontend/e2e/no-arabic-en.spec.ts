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

async function expectNoArabicLeak(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'networkidle' });
  const leaks = arabicLeaks(await englishCopyOutsideArabic(page));
  expect(leaks, `${path}: ${leaks.slice(0, 8).join(' | ')}`).toEqual([]);
}

test.use({ locale: 'en' });

test('English pages keep Arabic script inside lang="ar"', async ({ page }) => {
  for (const path of ['/en', '/en/sins', '/en/sins/ghibah', '/en/good-deeds', '/en/branches']) {
    await expectNoArabicLeak(page, path);
  }
});
