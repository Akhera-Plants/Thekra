import { munajjidAttribution } from '../structure/munajjid.js';
import { isMixed, type MatchSection } from './match.js';
import type { Topic, TopicSide } from './yaml.js';

export const BOOK_AR: Record<string, string> = {
  riyad: 'رياض الصالحين',
  targhib: 'صحيح الترغيب والترهيب',
  zuhd: 'الزهد والرقائق',
  minhaj: 'مختصر منهاج القاصدين',
  kabair: 'الكبائر',
  munajjid: 'سلسلة أعمال القلوب',
  adab: 'الأدب المفرد',
  bukhari: 'صحيح البخاري',
  muslim: 'صحيح مسلم',
};

const AUTHOR_AR: Record<string, string> = {
  riyad: 'النووي',
  kabair: 'الذهبي',
  targhib: 'المنذري',
  zuhd: 'ابن المبارك',
  minhaj: 'ابن قدامة',
};

/** Chapter note with an explicit Arabic book name (works without a BOOK_AR key, e.g. Ibn Abi al-Dunya). */
export function chapterNoteNamed(titleAr: string, bookAr: string, topics: ReadonlyMap<string, Topic>, slugs: readonly string[]): string {
  const note = `من باب: ${titleAr} — ${bookAr}`;
  return isMixed(slugs, topics) ? `${note} (باب مشترك)` : note;
}

export function chapterNote(section: MatchSection, topics: ReadonlyMap<string, Topic>, slugs: readonly string[]): string {
  return chapterNoteNamed(section.titleAr, BOOK_AR[section.book] ?? section.book, topics, slugs);
}

export function ayahNote(section: MatchSection): string {
  const author = AUTHOR_AR[section.book];
  if (!author) throw new Error(`No author attribution for ${section.book}`);
  return `أورده ${author} في باب: ${section.titleAr} — ${BOOK_AR[section.book] ?? section.book}`;
}

export function reviewerNote(section: MatchSection): string {
  return `تصنيف المراجع حسب موضوع الباب: ${section.titleAr} — ${BOOK_AR[section.book] ?? section.book}`;
}

export function keywordNote(section: MatchSection): string {
  return `اقتراح من عنوان الباب: ${section.titleAr} — ${BOOK_AR[section.book] ?? section.book}`;
}

export function takhrijNote(book: 'BUKHARI' | 'MUSLIM', number: number, section: { titleAr: string; book: string }): string {
  const name = book === 'BUKHARI' ? 'البخاري' : 'مسلم';
  return `رواه ${name} (${number}) — ورد في باب: ${section.titleAr} من ${BOOK_AR[section.book] ?? section.book}`;
}

export function hadeethencReviewerNote(): string {
  return 'تصنيف المراجع — موسوعة الأحاديث النبوية';
}

export function munajjidNote(page: string | null): string {
  const parsed = Number(page);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`Munajjid section has no page (${page ?? 'null'})`);
  return munajjidAttribution(parsed);
}

export function aiNote(): string {
  return 'تصنيف آلي حسب محتوى النص';
}

export function linkPriority(basis: string): number {
  if (basis === 'CHAPTER' || basis === 'CHAPTER_AYAH' || basis === 'AUTHOR_CITATION') return 50;
  if (basis === 'REVIEWER_SECTION') return 40;
  if (basis === 'AI_ITEM') return 30;
  if (basis === 'TAKHRIJ') return 20;
  return 10;
}

export type Side = TopicSide;
