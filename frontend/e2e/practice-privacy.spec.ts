import { expect, test } from '@playwright/test';

/**
 * «ترك المعصية» never names the sin outside the page body: generic tab title, no indexing, kept out of
 * robots. Server-rendered head only, so this runs without the API (the client data loads after).
 */
for (const [path, title] of [
  ['/practice/leave-sin', 'تذكرة من ذكرى'],
  ['/en/practice/leave-sin', 'A reminder from Thekra'],
] as const) {
  test(`${path} has a generic title and is not indexed`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(title);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });
}

test('robots.txt keeps the sin program out of crawlers', async ({ request }) => {
  const body = await (await request.get('/robots.txt')).text();
  expect(body).toContain('Disallow: /practice/leave-sin');
  expect(body).toContain('Disallow: /en/practice/leave-sin');
});
