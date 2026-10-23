import { expect, test, type Page } from '@playwright/test';

/** Direction of the topic reader's kind tabs and theme chips, as rendered. */
async function readerDirection(page: Page) {
  const tabs = page.locator('[data-slot=tabs]').first();
  await expect(tabs).toBeVisible();
  return page.evaluate(() => {
    const root = document.querySelector('[data-slot=tabs]');
    const triggers = [...(root?.querySelectorAll('[role=tab]') ?? [])].map((tab) => tab.getBoundingClientRect());
    const chips = document.querySelector('[role=group][aria-label]');
    return {
      html: document.documentElement.dir,
      tabs: root?.getAttribute('dir') ?? null,
      list: getComputedStyle(root?.querySelector('[role=tablist]') ?? document.body).direction,
      // First tab («الكل» / «All») sits at the start edge: right in RTL, left in LTR.
      firstTabStartsRight: triggers.length > 1 ? triggers[0]!.left > triggers[1]!.left : null,
      chipsLang: chips?.getAttribute('lang') ?? null,
      chipsDirection: chips ? getComputedStyle(chips).direction : null,
    };
  });
}

test('topic reader tabs and chips follow the locale, including after a language switch', async ({ page }) => {
  await page.goto('/sins/ghibah', { waitUntil: 'networkidle' });
  expect(await readerDirection(page)).toEqual({
    html: 'rtl',
    tabs: 'rtl',
    list: 'rtl',
    firstTabStartsRight: true,
    chipsLang: 'ar',
    chipsDirection: 'rtl',
  });

  // Client-side switch to English: no reload, everything flips with it.
  await page.locator('[data-locale-switch]').first().click();
  await page.waitForURL(/\/en\/sins\/ghibah/);
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('[data-slot=tabs]').first()).toHaveAttribute('dir', 'ltr');
  expect(await readerDirection(page)).toEqual({
    html: 'ltr',
    tabs: 'ltr',
    list: 'ltr',
    firstTabStartsRight: false,
    chipsLang: 'en',
    chipsDirection: 'ltr',
  });

  // And back to Arabic.
  await page.locator('[data-locale-switch]').first().click();
  await page.waitForURL((url) => url.pathname === '/sins/ghibah');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('[data-slot=tabs]').first()).toHaveAttribute('dir', 'rtl');
  expect((await readerDirection(page)).firstTabStartsRight).toBe(true);
});

test('no horizontal page scroll at 390px on the topic and home pages', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['/', '/en', '/sins/ghibah', '/en/sins/ghibah', '/good-deeds/silat-ar-rahim', '/en/branches/1']) {
    await page.goto(path, { waitUntil: 'networkidle' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
