/**
 * Verifies that athar items on the «الآثار» tab never show «حديث نبوي» as
 * their type badge.  The dhikr good-deed has 43 kept athar.
 *
 * Note: uses http://localhost:3000 explicitly so the client-side infinite query
 * (which calls localhost:3001) is not blocked by CORS.  The Playwright config
 * base URL is 127.0.0.1 to avoid port-conflict startup collisions, but
 * localhost:3000 and localhost:3001 share the same CORS origin.
 */
import { expect, test } from '@playwright/test';

test('الآثار tab on dhikr shows no «حديث نبوي» badge', async ({ page }) => {
  // Navigate with explicit localhost so the API CORS origin matches
  await page.goto('http://localhost:3000/good-deeds/dhikr', { waitUntil: 'networkidle' });

  // The tab must be visible (server countsByKind > 0)
  const atharTab = page.getByRole('tab', { name: /الآثار/ });
  await expect(atharTab).toBeVisible();

  // Click the tab — triggers kind=athar infinite query fetch
  await atharTab.click();

  // Wait for at least one quote card to appear (cards have aria-labelledby)
  await page.waitForSelector('article[aria-labelledby]', { timeout: 12000 });
  // Give React a beat to finish rendering all items
  await page.waitForTimeout(500);

  // Use browser-side evaluation to match on trimmed textContent of the badge
  // spans (which contain an SVG icon sibling).
  const { hasHadith, hasAthar } = await page.evaluate(() => {
    const badges = Array.from(
      document.querySelectorAll<HTMLElement>('article[aria-labelledby] header span.rounded-full'),
    );
    const texts = badges.map((el) => el.textContent?.trim() ?? '');
    return {
      hasHadith: texts.includes('حديث نبوي'),
      hasAthar: texts.includes('أثر'),
    };
  });

  // No athar card should carry the «حديث نبوي» type badge
  expect(hasHadith, 'found «حديث نبوي» badge on the الآثار tab').toBe(false);

  // At least one «أثر» badge should appear
  expect(hasAthar, 'no «أثر» badge found on the الآثار tab').toBe(true);
});
