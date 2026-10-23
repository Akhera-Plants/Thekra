import { arabicWords, indexByPrintedNumber, pickEntry } from './match.js';

const plain = (text: string) => text.trim();

describe('indexByPrintedNumber', () => {
  // Muslim: running number 6593 is printed 2589 (backbiting); running 2589 is printed 1109.01 (fasting).
  const english = [
    { hadithnumber: 2589, arabicnumber: 1109.01, text: 'He who is overtaken by dawn in a state of seminal emission' },
    { hadithnumber: 6593, arabicnumber: 2589, text: 'Do you know what is backbiting? They said: Allah and His Messenger know best' },
  ];
  const arabic = new Map([
    [2589, 'من أدركه الفجر جنبا فلا يصم'],
    [6593, 'أتدرون ما الغيبة قالوا الله ورسوله أعلم قال ذكرك أخاك بما يكره'],
  ]);
  const index = indexByPrintedNumber(english, arabic, plain);

  it('keys entries by the printed number, not the running number', () => {
    expect(index.get(2589)?.map((entry) => entry.english)).toEqual([english[1]!.text]);
    expect(index.get(1109)?.[0]?.main).toBe(false);
  });

  it('gives Muslim 2589 the backbiting English (audit B01)', () => {
    const stored = arabicWords('أَتَدْرُونَ مَا الْغِيبَةُ قَالُوا اللَّهُ وَرَسُولُهُ أَعْلَمُ قَالَ ذِكْرُكَ أَخَاكَ بِمَا يَكْرَهُ');
    expect(pickEntry(stored, index.get(2589) ?? [])?.entry.english).toMatch(/backbiting/);
  });

  it('skips entries without a printed number', () => {
    const only = indexByPrintedNumber([{ hadithnumber: 5, text: 'An entry with no printed number at all' }], new Map(), plain);
    expect(only.size).toBe(0);
  });
});

describe('pickEntry', () => {
  const entry = (arabic: string, english: string, main: boolean) => ({ arabic: arabicWords(arabic), english, main });

  it('prefers the sub-narration whose text matches the stored one', () => {
    const entries = [
      entry('حدثنا يحيى قال صوموا لرؤيته وأفطروا لرؤيته', 'main', true),
      entry('حدثنا قتيبة قال إذا رأيتم الهلال فصوموا وإذا رأيتموه فأفطروا', 'variant', false),
    ];
    expect(pickEntry(arabicWords('إذا رأيتم الهلال فصوموا وإذا رأيتموه فأفطروا'), entries)?.entry.english).toBe('variant');
  });

  it('falls back to the main narration when no variant is a strong match', () => {
    const entries = [
      entry('نهى النبي عن صوم يوم الفطر والنحر وعن صلاة بعد الصبح والعصر', 'main', true),
      entry('حدثنا موسى عن أبي سعيد بمثله', 'variant', false),
    ];
    expect(pickEntry(arabicWords('وعن صلاة بعد الصبح والعصر وعن الصماء'), entries)?.entry.english).toBe('main');
  });

  it('returns nothing when the entry is another text', () => {
    const entries = [entry('أسامة ردف رسول الله من عرفة إلى المزدلفة', 'riding', true)];
    expect(pickEntry(arabicWords('لا يلبس القمص ولا العمائم ولا السراويلات ولا البرانس'), entries)).toBeNull();
  });

  it('returns nothing for an empty stored text', () => {
    expect(pickEntry(new Set(), [entry('نص', 'x', true)])).toBeNull();
  });
});
