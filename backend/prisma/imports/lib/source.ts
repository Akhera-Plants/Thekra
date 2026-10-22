import type { PrismaClient } from '@prisma/client';
import { APPROVED_WORKS } from '../approved-works.js';

export type ApprovedWork = (typeof APPROVED_WORKS)[number];
export type BookKey = ApprovedWork['bookKey'];

export function approvedWork(bookKey: BookKey): ApprovedWork {
  const work = APPROVED_WORKS.find((candidate) => candidate.bookKey === bookKey);
  if (!work) throw new Error(`Unknown approved work ${bookKey}`);
  return work;
}

/** Upserts the work's Source by its fixed UUID — same fields as `seed.ts` writes. */
export async function ensureSource(prisma: PrismaClient, work: ApprovedWork): Promise<void> {
  const fields = {
    name: work.name,
    nameAr: work.nameAr,
    type: work.type,
    author: work.author,
    authorAr: work.authorAr,
    isExternalApi: false,
    apiProvider: work.bookKey,
  };
  await prisma.source.upsert({ where: { id: work.id }, create: { id: work.id, ...fields }, update: fields });
}
