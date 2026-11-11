/**
 * Builds the «مسار النص» steps for one text from whatever the admin API gives us.
 * Publish state is authoritative (public route answered 200 / 404); the *reason* is the
 * first known failing rule of the reader policy (backend grade-policy.ts readerClause):
 *   OCR text not verified → open HIGH flag → hadith without an approved grade.
 * When the API does not carry the fact that hid a text (gradeSource, flags on /admin/quotes),
 * the reason says so instead of guessing.
 */
import {
  adminLabel,
  APPROVED_GRADE_SOURCES,
  sourceName,
  type PublishReason,
  type TextSource,
} from '@/lib/format/admin-labels';
import { formatDigits } from '@/lib/format/digits';
import type { HadithGrade, QuoteType } from '@/lib/types/enums';
import type { TrailState, TrailStep } from '../components/kit/ProvenanceTrail';
import type { PublicState } from '../hooks/useAdminReview';

type Translate = (key: string, values?: Record<string, string | number>) => string;

export interface TrailInput {
  type?: QuoteType | null;
  source: { name: string; nameAr: string | null } | null;
  /** باب / chapter title when known. */
  chapter?: string | null;
  volume?: string | null;
  page?: string | null;
  gradeAuthority?: string | null;
  gradeReference?: string | null;
  hadithReference?: string | null;
  surah?: { name: string | null; ayah: number | null } | null;
  grade?: HadithGrade | null;
  /** Known only on the flag desk (the admin quote DTO omits it). */
  gradeSource?: string | null;
  textSource?: TextSource | null;
  textVerifiedAt?: string | null;
  /** Known only on the flag desk. */
  openHighFlag?: boolean;
}

export function buildTrail(
  input: TrailInput,
  publicState: PublicState | 'loading',
  t: Translate,
  locale: string,
): TrailStep[] {
  const isHadith = input.type === 'HADITH';
  const isVerse = input.type === 'QURAN_VERSE';

  // 1 · source
  const steps: TrailStep[] = [
    { id: 'source', label: t('source'), value: sourceName(input.source, locale), state: input.source ? 'ok' : 'warn' },
  ];

  // 2 · chapter / location
  const location =
    input.volume && input.page
      ? t('volumePage', { volume: formatDigits(input.volume), page: formatDigits(input.page) })
      : input.page
        ? t('page', { page: formatDigits(input.page) })
        : null;
  steps.push({
    id: 'chapter',
    label: t('chapter'),
    value: input.chapter ?? location ?? t('noChapter'),
    note: input.chapter && location ? location : undefined,
    state: input.chapter || location ? 'ok' : 'na',
  });

  // 3 · takhrij
  const takhrij = isVerse
    ? [input.surah?.name, input.surah?.ayah != null ? formatDigits(input.surah.ayah) : null].filter(Boolean).join(' · ')
    : [input.gradeAuthority, input.gradeReference ? formatDigits(input.gradeReference) : null]
        .filter(Boolean)
        .join(' · ') || (input.hadithReference ? formatDigits(input.hadithReference) : '');
  steps.push({
    id: 'takhrij',
    label: t('takhrij'),
    value: takhrij || (isHadith ? t('noTakhrij') : t('notApplicable')),
    state: takhrij ? 'ok' : isHadith ? 'warn' : 'na',
  });

  // 4 · grade
  const gradeState: TrailState = !isHadith
    ? 'na'
    : input.grade === 'SAHIH' || input.grade === 'HASAN'
      ? 'ok'
      : input.grade === 'DAIF'
        ? 'warn'
        : 'fail';
  const reason = publishReason(input, publicState);
  const unapproved = reason === 'UNAPPROVED_GRADE_SOURCE';
  steps.push({
    id: 'grade',
    label: t('grade'),
    value: isHadith ? adminLabel('grade', input.grade ?? 'UNGRADED', locale) : t('notApplicable'),
    note: isHadith && input.gradeSource ? adminLabel('gradeSource', input.gradeSource, locale) : undefined,
    state: unapproved ? 'fail' : gradeState === 'fail' && reason !== 'NO_GRADE' && reason !== 'MAWDU' ? 'warn' : gradeState,
  });

  // 5 · publish
  const publishState: TrailState =
    publicState === 'loading' ? 'pending' : publicState === 'public' ? 'ok' : publicState === 'hidden' ? 'fail' : 'warn';
  steps.push({
    id: 'publish',
    label: t('publish'),
    value:
      publicState === 'loading'
        ? t('checking')
        : publicState === 'public'
          ? t('published')
          : publicState === 'hidden'
            ? t('hidden')
            : t('unknown'),
    note: publicState === 'hidden' && reason ? adminLabel('publishReason', reason, locale) : undefined,
    state: publishState,
  });

  // The failing step is where the reason lives: grade problems ink the grade node.
  if (publicState === 'hidden' && (reason === 'NO_GRADE' || reason === 'MAWDU')) {
    const grade = steps.find((step) => step.id === 'grade');
    if (grade) grade.state = 'fail';
  }
  return steps;
}

function publishReason(input: TrailInput, publicState: PublicState | 'loading'): PublishReason | null {
  if (publicState !== 'hidden') return null;
  if (input.textSource === 'OCR' && !input.textVerifiedAt) return 'OCR_UNVERIFIED';
  if (input.openHighFlag) return 'HIGH_FLAG';
  if (input.type === 'HADITH' && input.grade === 'MAWDU') return 'MAWDU';
  if (input.type === 'HADITH' && (!input.grade || input.grade === 'UNGRADED')) return 'NO_GRADE';
  if (
    input.type === 'HADITH' &&
    input.gradeSource &&
    !(APPROVED_GRADE_SOURCES as readonly string[]).includes(input.gradeSource)
  ) {
    return 'UNAPPROVED_GRADE_SOURCE';
  }
  return 'UNKNOWN';
}
