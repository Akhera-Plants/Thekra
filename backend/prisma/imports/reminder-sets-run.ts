/**
 * «مجموعات التذكير» seed (redesign §4.6): upserts prisma/taxonomy/reminder-sets.yaml into the database.
 *
 *   pnpm --filter backend reminder-sets:import            dry run (default): prints what would change, writes nothing
 *   pnpm --filter backend reminder-sets:import --apply    writes
 *
 * Each set is matched by slug: titles, order and `published` come from the file, and its items are replaced by the
 * file's ids that are publishable in THIS database (a published verse or sahih/hasan hadith, no athar; the same rule
 * as the desk). Ids that are not are listed and skipped, never written. A second run writes nothing.
 * Sets in the database that are not in the file are left alone.
 *
 * Safety: refuses NODE_ENV=production unless IMPORT_ALLOW_PRODUCTION=true, and prints the database host first.
 */
import { registerHooks } from 'node:module';

if (process.env['NODE_ENV'] === 'production' && process.env['IMPORT_ALLOW_PRODUCTION'] !== 'true') {
  console.error('Refusing to import: NODE_ENV=production. Set IMPORT_ALLOW_PRODUCTION=true to override.');
  process.exit(1);
}

// Same `.js` → `.ts` fallback as run.ts (Node type stripping).
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith('.') || !specifier.endsWith('.js')) return nextResolve(specifier, context);
    try {
      return nextResolve(specifier, context);
    } catch {
      return nextResolve(`${specifier.slice(0, -3)}.ts`, context);
    }
  },
});

const { PrismaClient } = await import('@prisma/client');
const { readReminderSets } = await import('../../src/modules/reminder-sets/reminder-sets-yaml.js');
const { eligibleQuoteClause } = await import('../../src/modules/reminder-sets/reminder-set-rules.js');

const apply = process.argv.includes('--apply');
const host = (() => {
  try {
    return new URL(process.env['DATABASE_URL'] ?? '').host || '(unset)';
  } catch {
    return '(unparsable DATABASE_URL)';
  }
})();
console.log(`reminder-sets:import — ${apply ? 'APPLY' : 'dry run'} — database ${host}`);

const file = readReminderSets();
const prisma = new PrismaClient();
let writes = 0;
try {
  const allIds = [...new Set(file.sets.flatMap((set) => set.items))];
  const eligible = new Set(
    (await prisma.quote.findMany({ where: eligibleQuoteClause(allIds), select: { id: true } })).map((row) => row.id),
  );
  for (const seed of file.sets) {
    const items = seed.items.filter((id) => eligible.has(id));
    const skipped = seed.items.filter((id) => !eligible.has(id));
    const current = await prisma.reminderSet.findUnique({
      where: { slug: seed.slug },
      include: { items: { orderBy: { position: 'asc' }, select: { quoteId: true } } },
    });
    const fieldsChanged =
      !current ||
      current.titleAr !== seed.titleAr ||
      current.titleEn !== seed.titleEn ||
      current.sortOrder !== seed.sortOrder ||
      current.published !== seed.published;
    const itemsChanged = !current || JSON.stringify(current.items.map((item) => item.quoteId)) !== JSON.stringify(items);
    const state = !current ? 'new' : fieldsChanged || itemsChanged ? 'changed' : 'unchanged';
    console.log(`  ${seed.slug}: ${state}, ${items.length}/${seed.items.length} items${skipped.length ? `, skipped (not publishable here): ${skipped.join(', ')}` : ''}`);
    if (!apply || state === 'unchanged') continue;
    await prisma.$transaction(async (tx) => {
      const set = await tx.reminderSet.upsert({
        where: { slug: seed.slug },
        create: { slug: seed.slug, titleAr: seed.titleAr, titleEn: seed.titleEn, sortOrder: seed.sortOrder, published: seed.published },
        update: { titleAr: seed.titleAr, titleEn: seed.titleEn, sortOrder: seed.sortOrder, published: seed.published },
      });
      if (itemsChanged) {
        await tx.reminderSetItem.deleteMany({ where: { setId: set.id } });
        if (items.length > 0) await tx.reminderSetItem.createMany({ data: items.map((quoteId, position) => ({ setId: set.id, quoteId, position })) });
      }
    });
    writes++;
  }
  console.log(apply ? `Done: ${writes} set(s) written.` : 'Dry run: nothing written. Add --apply to write.');
} finally {
  await prisma.$disconnect();
}
