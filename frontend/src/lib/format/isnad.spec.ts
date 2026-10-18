import { describe, expect, it } from 'vitest';
import { splitMatn } from './isnad';

describe('splitMatn', () => {
  it('starts at the quoted matn after a chain', () => {
    const text =
      'أخبرنا أبو سعد الماليني، حدثنا قتيبة بن سعيد، عن أبي سعيد الخدري، قال: قال رسول الله صلى الله عليه وسلم: " لا حليم إلا ذو عثرة، ولا حكيم إلا ذو تجربة "';
    expect(splitMatn(text)).toEqual({
      matn: 'لا حليم إلا ذو عثرة، ولا حكيم إلا ذو تجربة',
      stripped: true,
    });
  });

  it('falls back to the last saying marker when there is no quote mark', () => {
    const text =
      'حدثنا مسدد، حدثنا يحيى، عن أنس، عن النبي صلى الله عليه وسلم قال: لا يؤمن أحدكم حتى يحب لأخيه ما يحب لنفسه';
    expect(splitMatn(text).matn).toBe('لا يؤمن أحدكم حتى يحب لأخيه ما يحب لنفسه');
  });

  it('leaves texts without a chain untouched', () => {
    const text = 'في حديث ابن عمر: «ما لم يغرغر»';
    expect(splitMatn(text)).toEqual({ matn: text, stripped: false });
  });

  it('keeps the whole text when the remainder is too short to be a matn', () => {
    const text = 'حدثنا فلان، عن فلان، قال: «نعم»';
    expect(splitMatn(text).stripped).toBe(false);
  });
});
