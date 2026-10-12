import { describe, expect, it } from 'vitest';
import { formatPrintedReference, parsePrintedReference, utcDayNumber } from './printed-reference.js';

describe('parsePrintedReference', () => {
  it('reads a trailing number', () => {
    expect(parsePrintedReference('al-Adab al-Mufrad 548')).toEqual({
      referenceNumber: 548,
      referenceLabel: null,
    });
  });

  it('keeps a parenthetical mark', () => {
    expect(parsePrintedReference('al-Adab al-Mufrad 548 (أ)')).toEqual({
      referenceNumber: 548,
      referenceLabel: 'أ',
    });
  });

  it('keeps a volume/page locator as a label', () => {
    expect(parsePrintedReference('Ahmad 5/428')).toEqual({
      referenceNumber: null,
      referenceLabel: '5/428',
    });
  });

  it('leaves a numberless string alone', () => {
    expect(parsePrintedReference('TEST-MAWDU')).toEqual({
      referenceNumber: null,
      referenceLabel: null,
    });
  });
});

describe('formatPrintedReference', () => {
  it('formats Arabic from the source name', () => {
    expect(
      formatPrintedReference({
        locale: 'ar',
        workAr: 'الأدب المفرد',
        workEn: 'Al-Adab al-Mufrad',
        referenceNumber: 548,
        referenceLabel: null,
      }),
    ).toBe('الأدب المفرد، رقم 548');
  });

  it('formats English from the source name', () => {
    expect(
      formatPrintedReference({
        locale: 'en',
        workAr: 'الجامع لشعب الإيمان (ط الرشد)',
        workEn: "Al-Jami' li-Shu'ab al-Iman (al-Rushd ed.)",
        referenceNumber: 5555,
        referenceLabel: null,
      }),
    ).toBe("Al-Jami' li-Shu'ab al-Iman (al-Rushd ed.) 5555");
  });

  it('does not emit a Latin work name in Arabic', () => {
    expect(
      formatPrintedReference({
        locale: 'ar',
        workAr: null,
        workEn: 'Bukhari',
        referenceNumber: 13,
        referenceLabel: null,
      }),
    ).toBeNull();
  });
});

describe('utcDayNumber', () => {
  it('is stable across the same UTC date', () => {
    const morning = new Date('2026-10-11T00:30:00.000Z');
    const evening = new Date('2026-10-11T22:00:00.000Z');
    expect(utcDayNumber(morning)).toBe(utcDayNumber(evening));
  });
});
