import { describe, expect, it } from 'vitest';
import { tidyArabicNumberRuns } from './ranges';

describe('tidyArabicNumberRuns', () => {
  it('writes a run of consecutive numbers as a range', () => {
    expect(tidyArabicNumberRuns('صيام الأيام البيض (13 و14 و15 من الشهر الهجري)')).toBe(
      'صيام الأيام البيض (من 13 إلى 15 من الشهر الهجري)',
    );
    expect(tidyArabicNumberRuns('13 و 14 و 15')).toBe('من 13 إلى 15');
  });
  it('keeps numbers that are not a run', () => {
    expect(tidyArabicNumberRuns('2 و5 و9')).toBe('2 و5 و9');
    expect(tidyArabicNumberRuns('الآية 13 و14')).toBe('الآية 13 و14');
    expect(tidyArabicNumberRuns('Days 13, 14 and 15')).toBe('Days 13, 14 and 15');
  });
});
