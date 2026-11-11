import { describe, expect, it } from 'vitest';
import { groupNarrations, normalizeArabicText, sameNarration, stripOuterQuotes } from './quote-text';

describe('stripOuterQuotes', () => {
  it('drops guillemets or straight quotes that wrap the whole text', () => {
    expect(stripOuterQuotes('«من يضمن لي ما بين لحييه»')).toBe('من يضمن لي ما بين لحييه');
    expect(stripOuterQuotes(' "إنما الأعمال بالنيات" ')).toBe('إنما الأعمال بالنيات');
    expect(stripOuterQuotes('«المسلم من سلم المسلمون من لسانه».')).toBe('المسلم من سلم المسلمون من لسانه.');
  });
  it('keeps marks that do not wrap the whole text', () => {
    const inner = 'قال: «أتدرون ما الغيبة؟» قالوا: الله ورسوله أعلم';
    expect(stripOuterQuotes(inner)).toBe(inner);
    const two = '«الأولى» ثم «الثانية»';
    expect(stripOuterQuotes(two)).toBe(two);
    expect(stripOuterQuotes('«»')).toBe('«»');
  });
});

describe('narration grouping', () => {
  it('normalizes diacritics, punctuation and letter forms', () => {
    expect(normalizeArabicText('«المُسلِمُ يَسلَمُ لَهُ صَومُهُ، يَتَّقِي الغِيبَةَ»')).toBe('المسلم يسلم له صومه يتقي الغيبه');
  });
  it('groups the same wording and a narration that quotes it whole', () => {
    expect(sameNarration('المسلم يسلم له صومه، يتقي الغيبة والكذب', 'المسلم يسلم له صومه يتقي الغيبة والكذب')).toBe(true);
    expect(
      sameNarration(
        'من يضمن لي ما بين لحييه وما بين رجليه أضمن له الجنة',
        'وعن سهل بن سعد، قال: قال رسول الله - صلى الله عليه وسلم: «من يضمن لي ما بين لحييه وما بين رجليه أضمن له الجنة»',
      ),
    ).toBe(true);
  });
  it('groups the same sentences said in another order', () => {
    expect(
      sameNarration(
        '«من كان يؤمن بالله واليوم الآخر فلا يؤذ جاره، ومن كان يؤمن بالله واليوم الآخر فليكرم ضيفه، ومن كان يؤمن بالله واليوم الآخر فليقل خيرا أو ليصمت»',
        '«من كان يؤمن بالله واليوم الآخر فليقل خيرا أو ليصمت، ومن كان يؤمن بالله واليوم الآخر فلا يؤذ جاره، ومن كان يؤمن بالله واليوم الآخر فليكرم ضيفه»',
      ),
    ).toBe(true);
  });
  it('keeps different texts apart, even when they start alike', () => {
    expect(
      sameNarration(
        'من كان يؤمن بالله واليوم الآخر فلا يؤذ جاره، ومن كان يؤمن بالله واليوم الآخر فليكرم ضيفه',
        'من كان يؤمن بالله واليوم الآخر فإذا شهد أمرا فليتكلم بخير أو ليسكت واستوصوا بالنساء',
      ),
    ).toBe(false);
    expect(sameNarration('قصير جدا', 'قصير جدا')).toBe(false);
  });
  it('leads with the first item and never mixes kinds', () => {
    const items = [
      { id: 'a', textAr: 'المسلم يسلم له صومه، يتقي الغيبة والكذب', kind: 'hadith' },
      { id: 'b', textAr: 'نص آخر مختلف تماما عن الأول في معناه ولفظه', kind: 'hadith' },
      { id: 'c', textAr: 'المسلم يسلم له صومه يتقي الغيبة والكذب', kind: 'hadith' },
      { id: 'd', textAr: 'المسلم يسلم له صومه يتقي الغيبة والكذب', kind: 'athar' },
    ];
    const groups = groupNarrations(items, (item) => item);
    expect(groups.map((g) => [g.lead.id, g.others.map((o) => o.id)])).toEqual([
      ['a', ['c']],
      ['b', []],
      ['d', []],
    ]);
  });
  it('leads with the best-ranked wording, in the place of the first one', () => {
    const items = [
      { id: 'later', textAr: 'المسلم يسلم له صومه، يتقي الغيبة والكذب', kind: 'hadith', rank: 1 },
      { id: 'other', textAr: 'نص آخر مختلف تماما عن الأول في معناه ولفظه', kind: 'hadith', rank: 1 },
      { id: 'sahih', textAr: 'المسلم يسلم له صومه يتقي الغيبة والكذب', kind: 'hadith', rank: 0 },
    ];
    const groups = groupNarrations(items, (item) => item, (item) => item.rank);
    expect(groups.map((g) => [g.lead.id, g.others.map((o) => o.id)])).toEqual([
      ['sahih', ['later']],
      ['other', []],
    ]);
  });
});
