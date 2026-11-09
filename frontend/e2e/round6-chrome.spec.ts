import { expect, test } from '@playwright/test';

/**
 * Owner round 6 (docs/plan/2026-11-09-owner-round-6.md §1, §7, §8): the header links and «المزيد ▾» (hover, click and
 * keyboard), nothing duplicated between them, settings only in the account menu, the skip link hidden until focused,
 * and the 404's one way home.
 */
test('header: the links, then «المزيد» with its own items; no «تصفّح النصوص», no settings', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/about', { waitUntil: 'networkidle' });
  const nav = page.getByRole('navigation', { name: 'التنقل الرئيسي' });
  for (const name of ['الرئيسية', 'الطاعات', 'تخفَّف من ذنب', 'شعب الإيمان', 'عاداتي']) {
    await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
  }
  await expect(nav.getByText('تصفّح النصوص')).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'الإعدادات' })).toHaveCount(0);

  // Keyboard: focus «المزيد», open with Enter, arrows move, Escape closes and returns focus.
  const more = nav.getByRole('button', { name: 'المزيد' });
  await more.focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('menu');
  await expect(menu.getByRole('menuitem')).toHaveText(['استراتيجيات العادات', 'المحفوظات', 'رفقة (في التطبيق)']);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(more).toBeFocused();

  // Hover opens it; leaving closes it.
  await more.hover();
  await expect(page.getByRole('menu')).toBeVisible();
  await page.mouse.move(700, 700);
  await expect(page.getByRole('menu')).toHaveCount(0);
});

test('the skip link is visually hidden until it has keyboard focus', async ({ page }) => {
  await page.goto('/about', { waitUntil: 'networkidle' });
  const skip = page.locator('.skip-link');
  expect((await skip.boundingBox())?.width ?? 0).toBeLessThanOrEqual(1);
  await page.keyboard.press('Tab');
  await expect(skip).toBeFocused();
  expect((await skip.boundingBox())?.width ?? 0).toBeGreaterThan(40);
});

test('404: the page title and one way back «العودة إلى الرئيسية»', async ({ page }) => {
  await page.goto('/no-such-page-round6', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('الصفحة غير موجودة');
  await expect(page.getByRole('main').getByRole('link', { name: 'العودة إلى الرئيسية' })).toHaveAttribute('href', '/');
});
