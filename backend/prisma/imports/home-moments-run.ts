/**
 * Home «في لحظات مثل هذه» seed (round 6, C-09): upserts prisma/taxonomy/home-moments.yaml into HomeMoment.
 *
 *   pnpm --filter backend home-moments:import            dry run (default): prints what would change, writes nothing
 *   pnpm --filter backend home-moments:import --apply    writes
 *
 * Each moment is matched by key; every field comes from the file. A moment whose topic is missing from THIS
 * database is listed and skipped, never written. A second run writes nothing. Rows that are not in the file (added
 * in the desk) are left alone.
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
const { readHomeMomentsSeed } = await import('../../src/modules/home-moments/home-moments-yaml.js');

const apply = process.argv.includes('--apply');
const host = (() => {
  try {
    return new URL(process.env['DATABASE_URL'] ?? '').host || '(unset)';
  } catch {
    return '(unparsable DATABASE_URL)';
  }
})();
console.log(`home-moments:import — ${apply ? 'APPLY' : 'dry run'} — database ${host}`);

const seeds = readHomeMomentsSeed();
const prisma = new PrismaClient();
let writes = 0;
try {
  for (const seed of seeds) {
    const exists = seed.topicType === 'SIN'
      ? await prisma.sin.count({ where: { slug: seed.topicSlug } })
      : seed.topicType === 'GOOD_DEED'
        ? await prisma.goodDeed.count({ where: { slug: seed.topicSlug } })
        : await prisma.imanBranch.count({ where: { number: Number(seed.topicSlug) } });
    if (exists === 0) {
      console.log(`  ${seed.key}: skipped, ${seed.topicType} "${seed.topicSlug}" is not in this database`);
      continue;
    }
    const { key, ...fields } = seed;
    const current = await prisma.homeMoment.findUnique({ where: { key } });
    const changed = !current || (Object.keys(fields) as Array<keyof typeof fields>).some((field) => current[field] !== fields[field]);
    console.log(`  ${key}: ${!current ? 'new' : changed ? 'changed' : 'unchanged'}`);
    if (!apply || !changed) continue;
    await prisma.homeMoment.upsert({ where: { key }, create: seed, update: fields });
    writes++;
  }
  console.log(apply ? `Done: ${writes} moment(s) written.` : 'Dry run: nothing written. Add --apply to write.');
} finally {
  await prisma.$disconnect();
}
