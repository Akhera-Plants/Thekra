/**
 * Parses an Arabic ordinal (1–99) at the start of a string, masculine or
 * feminine: «الأول», «الحادية عشرة», «السابع والعشرون», «الخمسون» …
 */

const UNITS: ReadonlyArray<readonly [number, readonly string[]]> = [
  [1, ['الأول', 'الأولى', 'الحادي', 'الحادية']],
  [2, ['الثاني', 'الثانية']],
  [3, ['الثالث', 'الثالثة']],
  [4, ['الرابع', 'الرابعة']],
  [5, ['الخامس', 'الخامسة']],
  [6, ['السادس', 'السادسة']],
  [7, ['السابع', 'السابعة']],
  [8, ['الثامن', 'الثامنة']],
  [9, ['التاسع', 'التاسعة']],
];

const TENS: ReadonlyArray<readonly [number, string]> = [
  [20, 'العشرون'],
  [30, 'الثلاثون'],
  [40, 'الأربعون'],
  [50, 'الخمسون'],
  [60, 'الستون'],
  [70, 'السبعون'],
  [80, 'الثمانون'],
  [90, 'التسعون'],
];

/**
 * Spellings seen in the corpus that are not standard ordinals. Each entry is a
 * typo in the source heading; accepting it here keeps the heading text verbatim.
 */
const UNIT_VARIANTS: ReadonlyArray<readonly [number, string]> = [
  [1, 'الحاديثة'], // al-Kabair (Shamela 6848), heading 31
];

const TEEN_SUFFIX = ['عشرة', 'عشر'];

export interface OrdinalMatch {
  value: number;
  /** Characters consumed from the start of the input. */
  length: number;
}

function unitForms(): Array<readonly [number, string]> {
  const forms: Array<readonly [number, string]> = [];
  for (const [value, words] of UNITS) for (const word of words) forms.push([value, word]);
  return [...forms, ...UNIT_VARIANTS];
}

const ORDINAL_FORMS: ReadonlyArray<readonly [number, string]> = (() => {
  const forms: Array<readonly [number, string]> = [];
  for (const [unit, word] of unitForms()) {
    for (const [tens, tensWord] of TENS) forms.push([unit + tens, `${word} و${tensWord}`]);
    for (const suffix of TEEN_SUFFIX) forms.push([unit + 10, `${word} ${suffix}`]);
  }
  for (const [tens, tensWord] of TENS) forms.push([tens, tensWord]);
  forms.push([10, 'العاشر'], [10, 'العاشرة']);
  for (const form of unitForms()) forms.push(form);
  // Longest first, so «الحادي عشر» wins over «الحادي».
  return forms.sort((a, b) => b[1].length - a[1].length);
})();

const WORD_END = /^(?:$|[\s،,:؛."«»()])/;

/** Matches an ordinal at the start of `text` (after leading spaces), or null. */
export function parseLeadingOrdinal(text: string): OrdinalMatch | null {
  const trimmed = text.trimStart();
  const offset = text.length - trimmed.length;
  for (const [value, form] of ORDINAL_FORMS) {
    if (trimmed.startsWith(form) && WORD_END.test(trimmed.slice(form.length))) {
      return { value, length: offset + form.length };
    }
  }
  return null;
}
