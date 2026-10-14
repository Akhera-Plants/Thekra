import { describe, expect, it } from 'vitest';
import { citedMatns, munajjidChapters, munajjidAttribution } from './munajjid.js';

describe('munajjid citations', () => {
  it('slices chapters on the printed index and keeps only quotations', () => {
    const pages = Array.from({ length: 40 }, (_, index) => `PAGE_SEPARATOR\nصفحة ${index + 1}`);
    pages[5] = 'PAGE_SEPARATOR\nالإخلاص [البينة: 5] «إنما الأعمال بالنيات» رواه البخاري';
    pages[34] = 'PAGE_SEPARATOR\nالخوف';
    const chapters = munajjidChapters(pages.join('\n'));
    expect(chapters).toHaveLength(12);
    expect(chapters[0]).toMatchObject({ titleAr: 'الإخلاص', pageFrom: 7, pageTo: 35 });
    expect(chapters[0]?.body.includes('[البينة: 5]')).toBe(true);
    expect(chapters[1]).toMatchObject({ titleAr: 'الخوف', pageFrom: 36 });
    expect(citedMatns(chapters[0]?.body ?? '').map((hit) => hit.matn)).toEqual(['إنما الأعمال بالنيات']);
    expect(munajjidAttribution(7)).toBe('ذكره الشيخ محمد صالح المنجد في سلسلة أعمال القلوب، ص 7');
  });
});
