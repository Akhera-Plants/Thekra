import { describe, expect, it } from 'vitest';
import { NAV_FEATURES, WEB_REDIRECTS } from '@thekra/practice-core';
import { webRedirectRules } from './redirects';

const rules = webRedirectRules(WEB_REDIRECTS, NAV_FEATURES.map((f) => f.web));
const target = (source: string) => rules.find((r) => r.source === source)?.destination;

describe('web redirects (round 5 §1, practice-core WEB_REDIRECTS)', () => {
  it('sends every old path to its new place, in Arabic and English', () => {
    for (const { from, to } of WEB_REDIRECTS) {
      expect(target(from)).toBe(to);
      expect(target(`/en${from}`)).toBe(to === '/' ? '/en' : `/en${to}`);
    }
    expect(rules.every((r) => r.permanent)).toBe(true);
  });

  it('lands on pages that exist in the nav map', () => {
    const routes = new Set(NAV_FEATURES.map((f) => f.web));
    for (const { to } of WEB_REDIRECTS) expect(routes.has(to), to).toBe(true);
  });

  it('follows sub-paths, except where a page lives under the old path', () => {
    expect(target('/names/:rest+')).toBe('/');
    expect(target('/en/names/:rest+')).toBe('/en');
    expect(target('/calendar/:rest+')).toBe('/practice/record');
    // Round 6: `/practice/habits` is the «العادات» tab again (no redirect); `/practice/people` goes to the periodic acts.
    expect(target('/practice/habits')).toBeUndefined();
    expect(target('/practice/people/:rest+')).toBe('/practice/periodic');
    expect(target('/browse/:rest+')).toBe('/');
  });

  it('never redirects a current page', () => {
    const current = NAV_FEATURES.flatMap((f) => (f.web ? [f.web] : []));
    for (const rule of rules) expect(current, rule.source).not.toContain(rule.source);
  });
});
