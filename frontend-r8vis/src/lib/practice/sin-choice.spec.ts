import { describe, expect, it } from 'vitest';
import { groupSinsForChooser, type SinOption } from './sin-choice';

const sins: SinOption[] = [
  { slug: 'ghiba', nameAr: 'الغيبة', name: 'Backbiting', domainKey: 'lisan', taxonomyOrder: 2 },
  { slug: 'kadhib', nameAr: 'الكذب', name: 'Lying', domainKey: 'lisan', taxonomyOrder: 1 },
  { slug: 'riba', nameAr: 'الربا', name: 'Usury', domainKey: 'mal', taxonomyOrder: 1 },
  { slug: 'nazar', nameAr: 'إطلاق البصر', name: 'Looking', domainKey: null },
  { slug: 'x', nameAr: 'غضّ', name: null, domainKey: 'unknown' },
];

describe('groupSinsForChooser', () => {
  it('groups by the given domain order, unknown domains next, no domain last', () => {
    const groups = groupSinsForChooser(sins, '', ['mal', 'lisan']);
    expect(groups.map((g) => g.domain)).toEqual(['mal', 'lisan', 'unknown', null]);
    expect(groups[1].sins.map((s) => s.slug)).toEqual(['kadhib', 'ghiba']);
  });

  it('filters by a folded Arabic or English name and drops empty groups', () => {
    expect(groupSinsForChooser(sins, 'غض', []).flatMap((g) => g.sins.map((s) => s.slug))).toEqual(['x']);
    expect(groupSinsForChooser(sins, 'اطلاق', []).flatMap((g) => g.sins.map((s) => s.slug))).toEqual(['nazar']);
    expect(groupSinsForChooser(sins, 'usury', ['mal'])).toEqual([{ domain: 'mal', sins: [sins[2]] }]);
    expect(groupSinsForChooser(sins, 'nothing', [])).toEqual([]);
  });
});
