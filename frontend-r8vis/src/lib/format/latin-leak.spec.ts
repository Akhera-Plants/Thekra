import { describe, expect, it } from 'vitest';
import { latinLeaks } from './latin-leak';

describe('latinLeaks', () => {
  it('allows the language switch and nothing else', () => {
    expect(latinLeaks('ذكرى\nEnglish\nالأدب المفرد، رقم ٥٤٨')).toEqual([]);
  });

  it('reports a Latin reference', () => {
    expect(latinLeaks('al-Adab al-Mufrad 548')).toEqual(['al', 'Adab', 'al', 'Mufrad']);
  });

  it('does not treat English inside a sentence as the switch', () => {
    expect(latinLeaks('اقرأ English هنا')).toEqual(['English']);
  });
});
