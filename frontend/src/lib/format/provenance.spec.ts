import { describe, expect, it } from 'vitest';
import { englishOnlyProvenance } from './provenance';

describe('englishOnlyProvenance', () => {
  it('keeps the English part and drops an untranslated Arabic tail', () => {
    expect(englishOnlyProvenance('الكبائر للذهبي، الكبيرة رقم 4 — الكبيرة الرابعة')).toBe(
      'Al-Kabair by al-Dhahabi, major sin no. 4',
    );
  });

  it('returns null when nothing English is left', () => {
    expect(englishOnlyProvenance('باب لم يترجم')).toBeNull();
    expect(englishOnlyProvenance(null)).toBeNull();
  });

  it('leaves a fully English reference as it is', () => {
    expect(englishOnlyProvenance('صحيح البخاري، رقم 1992')).toBe('Sahih al-Bukhari, no. 1992');
  });
});
