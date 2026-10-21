/**
 * Apply the reviewer's keep / drop sheet. A second run writes nothing.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ImportOptions } from '../lib/cli.js';
import { parseReviewTsv, reviewWrite } from './review.js';

export async function runAtharReviewImport(options: ImportOptions): Promise<void> {
  const path = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../docs/taxonomy/athar-review.tsv');
  const rows = parseReviewTsv(readFileSync(path, 'utf8'));
  const decided = rows.filter((row) => row.decision);
  if (decided.length === 0) {
    console.log(`athar review: rows=${rows.length} decided=0 updated=0 missing=0 tsv=${path}`);
    return;
  }
  const current = await options.prisma.quote.findMany({
    where: { id: { in: decided.map((row) => row.quoteId) } },
    select: {
      id: true,
      atharReviewDecision: true,
      atharTextAr: true,
      atharAttributionKind: true,
    },
  });
  const byId = new Map(current.map((row) => [row.id, row]));
  let updated = 0;
  let missing = 0;

  for (const row of decided) {
    const stored = byId.get(row.quoteId);
    if (!stored) {
      missing += 1;
      continue;
    }
    const write = reviewWrite(stored, row);
    if (!write) continue;
    if (!options.dryRun) {
      await options.prisma.quote.update({ where: { id: row.quoteId }, data: write });
    }
    updated += 1;
  }

  console.log(
    `athar review: rows=${rows.length} decided=${decided.length} updated=${updated} missing=${missing} tsv=${path}`,
  );
}
