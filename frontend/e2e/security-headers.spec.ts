/**
 * Security headers + CSP smoke check.
 *
 * Meant for the production build (`pnpm build && pnpm start -p 3100`, API on
 * :3001) with PLAYWRIGHT_BASE_URL=http://localhost:3100. It also runs against
 * `next dev`, where the CSP additionally allows 'unsafe-eval' and the HMR socket.
 *
 * Fails if any page logs a Content-Security-Policy violation, either through
 * the console or a `securitypolicyviolation` DOM event.
 */
import { expect, test } from '@playwright/test';

const PAGES = ['/', '/good-deeds/dhikr', '/en', '/admin'];

for (const path of PAGES) {
  test(`no CSP violations on ${path}`, async ({ page }) => {
    const cspConsole: string[] = [];
    page.on('console', (msg) => {
      if (/Content[- ]Security[- ]Policy/i.test(msg.text())) cspConsole.push(msg.text());
    });
    // Injected by the driver, so it runs even under a strict script-src.
    await page.addInitScript(() => {
      const w = window as unknown as { __cspViolations: string[] };
      w.__cspViolations = [];
      document.addEventListener('securitypolicyviolation', (e) => {
        w.__cspViolations.push(
          `${e.violatedDirective} ${e.blockedURI} at ${e.sourceFile}:${e.lineNumber}:${e.columnNumber}`,
        );
      });
    });

    const response = await page.goto(path, { waitUntil: 'networkidle' });
    expect(response, `no response for ${path}`).not.toBeNull();

    // Headers come from next.config.ts headers(); check the final document.
    const headers = await response!.allHeaders();
    const csp = headers['content-security-policy'] ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['permissions-policy']).toContain('camera=()');

    // Let late client fetches (React Query) settle.
    await page.waitForTimeout(500);
    const domViolations = await page.evaluate(
      () => (window as unknown as { __cspViolations: string[] }).__cspViolations,
    );

    console.log(
      `[csp] ${path} status=${response!.status()} console=${cspConsole.length} events=${domViolations.length}`,
    );
    expect(cspConsole, `CSP console errors on ${path}`).toEqual([]);
    expect(domViolations, `CSP violation events on ${path}`).toEqual([]);
  });
}
