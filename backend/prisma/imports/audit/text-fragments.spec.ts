import { arabicWords } from '../translations/match.js';
import { fragmentReason } from './text-fragments.js';

const entry = (text: string) => [...arabicWords(text)];

describe('fragmentReason', () => {
  const bukhari1992 = entry(
    'حدثنا موسى بن إسماعيل حدثنا وهيب حدثنا عمرو بن يحيى عن أبيه عن أبي سعيد رضى الله عنه قال نهى النبي صلى الله عليه وسلم عن صوم يوم الفطر والنحر وعن الصماء وأن يحتبي الرجل في ثوب واحد وعن صلاة بعد الصبح والعصر',
  );

  it('lists the truncated featured text of audit B03', () => {
    expect(fragmentReason('وعن صلاة بعد الصبح والعصر»', [bukhari1992])).toBe('short');
  });

  it('lists a longer piece that is a small part of the edition entry', () => {
    // Seventy distinct filler words around the stored piece.
    const letters = 'بتثجحخدذرزسشصضطظعغفقكلمن';
    const filler = Array.from({ length: 70 }, (_, i) => `كل${letters[i % letters.length]}${letters[Math.floor(i / letters.length)]}`).join(' ');
    const long = entry(`${filler} وعن الصماء وأن يحتبي الرجل في ثوب واحد`);
    expect(fragmentReason('وعن الصماء وأن يحتبي الرجل في ثوب واحد', [long])).toBe('fragment');
  });

  it('does not list a whole narration', () => {
    const stored = 'نهى النبي صلى الله عليه وسلم عن صوم يوم الفطر والنحر وعن الصماء وأن يحتبي الرجل في ثوب واحد وعن صلاة بعد الصبح والعصر';
    expect(fragmentReason(stored, [bukhari1992])).toBeNull();
  });

  it('ignores an empty text', () => {
    expect(fragmentReason('', [bukhari1992])).toBeNull();
  });
});
