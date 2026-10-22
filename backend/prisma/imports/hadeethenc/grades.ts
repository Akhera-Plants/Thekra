import { HadithGrade } from '@prisma/client';
import { normalizeGrade } from '../../../src/modules/content-sync/mappers/grade.mapper.js';

/** HadeethEnc is publishable only for صحيح / حسن (and their English forms). */
export function mapHadeethencGrade(raw: string | null | undefined): {
  grade: HadithGrade;
  publishable: boolean;
} {
  const { grade } = normalizeGrade(raw);
  const publishable = grade === HadithGrade.SAHIH || grade === HadithGrade.HASAN;
  return { grade, publishable };
}

export const HADEETHENC_AUTHORITY_AR = 'موسوعة الأحاديث النبوية';
export const HADEETHENC_AUTHORITY_EN = 'Hadeeth Encyclopedia';

/** First non-empty line of the API reference block. */
export function referenceLine(reference: string | null | undefined): string | null {
  if (!reference) return null;
  const line = reference
    .split(/\n/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .find(Boolean);
  return line ?? null;
}
