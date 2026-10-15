import { citedEditions, plainEnglish } from './citation.js';

describe('citedEditions', () => {
  it('reads a sunan reference and a Sahihayn number', () => {
    expect(citedEditions('سنن أبي داود، رقم 3116')).toEqual([{ book: 'abudawud', number: 3116 }]);
    expect(citedEditions('البخاري 3425')).toEqual([{ book: 'bukhari', number: 3425 }]);
    expect(citedEditions('مسلم 2072')).toEqual([{ book: 'muslim', number: 2072 }]);
  });

  it('keeps both books of a muttafaq citation, Bukhari first', () => {
    expect(citedEditions('البخاري 600، مسلم 2742')).toEqual([
      { book: 'bukhari', number: 600 },
      { book: 'muslim', number: 2742 },
    ]);
  });

  it('reads every sunan the stored grade cites', () => {
    expect(citedEditions('سنن أبي داود، رقم 1479، سنن الترمذي، رقم 3593')).toEqual([
      { book: 'abudawud', number: 1479 },
      { book: 'tirmidhi', number: 3593 },
    ]);
    expect(citedEditions('سنن ابن ماجه، رقم 1350')).toEqual([{ book: 'ibnmajah', number: 1350 }]);
  });

  it('ignores a citation that names no number', () => {
    expect(citedEditions('رواه مسلم')).toEqual([]);
    expect(citedEditions(null)).toEqual([]);
  });
});

describe('plainEnglish', () => {
  it('drops footnote markup', () => {
    expect(plainEnglish('In the name <sup foot_note="1">1</sup> of Allah.')).toBe('In the name 1 of Allah.');
  });
});
