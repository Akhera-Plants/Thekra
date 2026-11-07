import { expect, test } from '@playwright/test';

/**
 * Owner round 5 §1 (web table): every old path answers with a permanent redirect to its new place, in Arabic and
 * English, before any page renders (next.config `redirects()`, built from practice-core `WEB_REDIRECTS`).
 */
const CASES: [string, string][] = [
  ['/practice/reviews', '/practice/review'],
  ['/practice/pledges', '/practice/review'],
  ['/calendar', '/practice/record'],
  ['/practice/habits', '/practice/record'],
  ['/practice/kinship?circle=friends', '/practice/people?circle=friends'],
  ['/practice/my-reminders', '/favorites/reminders'],
  ['/practice/notifications', '/settings/notifications'],
  ['/practice/prayer-times', '/settings/prayer-times'],
  ['/names', '/'],
  ['/names/al-rahman', '/'],
];

for (const [from, to] of CASES) {
  for (const prefix of ['', '/en']) {
    test(`${prefix}${from} → ${prefix}${to}`, async ({ request }) => {
      const res = await request.get(`${prefix}${from}`, { maxRedirects: 0 });
      expect(res.status()).toBe(308);
      const location = new URL(res.headers()['location'] ?? '', 'http://x');
      const expected = to === '/' ? prefix || '/' : `${prefix}${to}`;
      expect(`${location.pathname}${location.search}`).toBe(expected);
    });
  }
}

test('the habit page is not redirected', async ({ request }) => {
  const res = await request.get('/practice/habits/00000000-0000-4000-8000-000000000000', { maxRedirects: 0 });
  expect(res.status()).toBe(200);
});
