/**
 * Idempotent correction: writes the catalogue English title (DUNYA_TITLES_EN via
 * DUNYA_BOOKS.titleEn) into Source.name for every Ibn Abi al-Dunya source whose
 * name still differs. The full importer writes the same value on its next run;
 * this applies it without re-importing the books.
 *
 * Only `name` is touched. nameAr, quotes, and links are left as they are.
 * A second run updates 0 rows.
 *
 * Usage:
 *   pnpm --filter backend import:book dunya-source-names [--dry-run]
 */
import type { ImportOptions } from '../lib/cli.js';
import { DUNYA_BOOKS } from '../ibn-abi-dunya/books.js';

export async function runDunyaSourceNamesCleanup(options: ImportOptions): Promise<void> {
  const { prisma, dryRun } = options;

  const rows = await prisma.source.findMany({
    where: { id: { in: DUNYA_BOOKS.map((book) => book.id) } },
    select: { id: true, name: true, nameAr: true, apiProvider: true },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));

  let updated = 0;
  let unchanged = 0;
  let missing = 0;

  for (const book of DUNYA_BOOKS) {
    const row = byId.get(book.id);
    if (!row) {
      missing += 1;
      continue;
    }
    if (row.apiProvider !== book.apiProvider) {
      throw new Error(
        `Source ${book.id} has apiProvider ${row.apiProvider ?? 'null'}, expected ${book.apiProvider}; refusing to rename`,
      );
    }
    if (row.name === book.titleEn) {
      unchanged += 1;
      continue;
    }
    console.log(`  ${book.key.padEnd(18)} ${row.nameAr ?? ''} | ${row.name} → ${book.titleEn}`);
    if (!dryRun) {
      await prisma.source.update({ where: { id: book.id }, data: { name: book.titleEn } });
    }
    updated += 1;
  }

  const mode = dryRun ? '[dry-run] would update' : 'updated';
  console.log(
    `dunya-source-names: ${mode} ${updated} rows, unchanged ${unchanged}, not imported ${missing}`,
  );
}
