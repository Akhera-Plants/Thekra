import { norm } from './norm.js';

const UNITS = ['', 'الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة'] as const;
const TENS = ['', '', 'العشرون', 'الثلاثون', 'الأربعون', 'الخمسون', 'الستون', 'السبعون'] as const;
const UNIT_JOIN = ['', 'الحادية', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة'] as const;

/**
 * Surface forms of الكبيرة N in this edition, longest first when searched.
 * 11–19 are printed both as «عشرة» and «عشر». 31 is printed «الحاديثة».
 */
function forms(number: number): string[] {
  if (number < 1 || number > 70) return [];
  if (number <= 10) return [UNITS[number] ?? ''];
  if (number < 20) {
    const unit = UNIT_JOIN[number - 10] ?? '';
    return [`${unit} عشرة`, `${unit} عشر`];
  }
  if (number % 10 === 0) return [TENS[number / 10] ?? ''];
  const unit = UNIT_JOIN[number % 10] ?? '';
  const ten = TENS[Math.floor(number / 10)] ?? '';
  const form = `${unit} و${ten}`;
  return number === 31 ? [form, `الحاديثة و${ten}`] : [form];
}

const PHRASES: readonly { number: number; phrase: string }[] = (() => {
  const rows: { number: number; phrase: string }[] = [];
  for (let number = 1; number <= 70; number += 1) {
    for (const phrase of forms(number)) {
      if (phrase) rows.push({ number, phrase });
    }
  }
  return rows.sort((a, b) => b.phrase.length - a.phrase.length);
})();

/** The kabira ordinal printed in a KABIRA title, from الأولى through السبعون. */
export function ordinalInTitle(title: string): number | null {
  const text = norm(title);
  for (const row of PHRASES) {
    if (text.includes(norm(row.phrase))) return row.number;
  }
  return null;
}
