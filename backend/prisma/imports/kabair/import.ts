/**
 * Uses «الكبائر» (attributed to al-Dhahabi) as the rank source: existing sins
 * that clearly match a كبيرة heading get rank = KABIRA with a citation; every
 * other heading becomes a new Sin (slug kabira-<N>). Never sets SAGHIRA and
 * never imports Dhahabi's evidence texts.
 */
import { SinRank, type PrismaClient } from '@prisma/client';
import { pickRandom, type ImportOptions } from '../lib/cli.js';
import { loadCorpus, type CorpusSpec } from '../lib/corpus.js';
import { assertArabicText } from '../lib/guard.js';
import { formatSummary, withRunLog } from '../lib/run-log.js';
import { approvedWork, ensureSource } from '../lib/source.js';
import { kabiraReference, kabiraSlug, matchSinToKabira, parseKabair, type KabiraHeading, type SinMatch } from './parse.js';

const KABAIR_CORPUS: CorpusSpec = {
  repo: '0750AH',
  path: 'data/0748Dhahabi/0748Dhahabi.Kabair/0748Dhahabi.Kabair.Shamela0006848-ara1',
  commit: '9168f4a124537948de88cba6adfacf560bc35d35',
  sha256: '4cccf7f3de5da10fcc52f78422f5a03dfc6ea4fd29ac15da72935be169783b1a',
};

/** Draft English names for new sins — for the owner to review, not translations of record. */
const KABIRA_ENGLISH_DRAFTS: Readonly<Record<number, string>> = {
  1: 'Associating partners with Allah',
  2: 'Killing a soul',
  3: 'Sorcery',
  4: 'Abandoning prayer',
  5: 'Withholding zakat',
  6: 'Breaking a Ramadan fast without excuse',
  7: 'Not performing Hajj despite ability',
  8: 'Disobeying parents',
  9: 'Shunning relatives',
  10: 'Fornication',
  11: 'Sodomy',
  12: 'Usury',
  13: "Consuming an orphan's wealth",
  14: 'Lying about Allah and His Messenger',
  15: 'Fleeing from battle',
  16: 'A ruler deceiving and wronging his subjects',
  17: 'Arrogance',
  18: 'False testimony',
  19: 'Drinking wine',
  20: 'Gambling',
  21: 'Slandering chaste women',
  22: 'Stealing from war spoils',
  23: 'Theft',
  24: 'Highway robbery',
  25: 'The false oath',
  26: 'Oppression',
  27: 'Unjust tax collecting',
  28: 'Consuming the unlawful',
  29: 'Suicide',
  30: 'Habitual lying',
  31: 'The corrupt judge',
  32: 'Taking bribes for a judgment',
  33: 'Men and women imitating each other',
  34: 'The complacent husband and the procurer',
  35: 'The muhallil and the one he acts for',
  36: 'Not guarding against urine',
  37: 'Showing off',
  38: 'Seeking knowledge for worldly gain and concealing knowledge',
  39: 'Betraying a trust',
  40: 'Reminding others of favours done',
  41: 'Denying divine decree',
  42: "Eavesdropping on people's secrets",
  43: 'Tale-bearing',
  44: 'Habitual cursing',
  45: 'Treachery and breaking covenants',
  46: 'Believing soothsayers and astrologers',
  47: "A wife's defiance of her husband",
  48: 'Making images',
  49: 'Wailing and tearing clothes at a calamity',
  50: 'Transgression',
  51: 'Abusing the weak, servants, wives and animals',
  52: "Harming one's neighbour",
  53: 'Harming and reviling Muslims',
  54: "Harming Allah's servants and lording over them",
  55: 'Trailing garments out of pride',
  56: 'Men wearing silk and gold',
  57: 'A slave running away',
  58: 'Sacrificing to other than Allah',
  59: "Claiming descent from other than one's father",
  60: 'Quarrelsome disputation',
  61: 'Withholding surplus water',
  62: 'Giving short measure',
  63: "Feeling secure from Allah's plan",
  65: 'Leaving congregational prayer without excuse',
  66: 'Persistently missing Friday and congregational prayer',
  67: 'Causing harm through a will',
  68: 'Deception and trickery',
  69: 'Spying on Muslims and exposing their faults',
  70: 'Reviling the Companions',
};

interface SinRow {
  id: string;
  slug: string;
  nameAr: string;
  rank: SinRank | null;
  rankSourceId: string | null;
}

export async function runKabairImport({ prisma, dryRun, limit }: ImportOptions): Promise<void> {
  const work = approvedWork('book:dhahabi-kabair');
  const corpus = await loadCorpus(KABAIR_CORPUS);
  const parsed = parseKabair(corpus.text);
  const guard = assertArabicText(parsed.headings.map((heading) => heading.headingText));
  const headings = limit === null ? parsed.headings : parsed.headings.slice(0, limit);

  console.log(`corpus ${corpus.versionUri}@${KABAIR_CORPUS.commit}, Arabic ratio ${guard.ratio.toFixed(4)}`);
  console.log(
    `parsed: ${parsed.headings.length} كبيرة headings (1–${parsed.headings.at(-1)?.number ?? 0}),` +
      ` missing=${parsed.missingNumbers.join(',') || 'none'} duplicates=${parsed.duplicates.length}`,
  );

  // Existing sins only — the rows this importer creates are never matched against.
  const sins: SinRow[] = await prisma.sin.findMany({
    where: { NOT: { slug: { startsWith: 'kabira-' } } },
    select: { id: true, slug: true, nameAr: true, rank: true, rankSourceId: true },
    orderBy: { slug: 'asc' },
  });
  const matches = sins.map((sin) => ({ sin, match: matchSinToKabira(sin.nameAr, headings) }));
  for (const { sin, match } of matches) console.log(`  ${sin.slug} «${sin.nameAr}» → ${describe(match)}`);
  const matchedNumbers = new Set(matches.flatMap(({ match }) => (match.heading ? [match.heading.number] : [])));
  const newHeadings = headings.filter((heading) => !matchedNumbers.has(heading.number));
  const missingDrafts = newHeadings.filter((heading) => !KABIRA_ENGLISH_DRAFTS[heading.number]);
  if (missingDrafts.length > 0) {
    throw new Error(`No English draft name for كبيرة ${missingDrafts.map((heading) => heading.number).join(', ')}`);
  }
  console.log(`new sins to create/update: ${newHeadings.length}`);

  if (dryRun) {
    console.log('sample:');
    for (const heading of pickRandom(headings, 5)) {
      console.log(`  كبيرة ${heading.number}: ${heading.nameAr} | ${heading.headingText.slice(0, 120)}`);
    }
    console.log('dry run: nothing written');
    return;
  }

  await ensureSource(prisma, work);
  await withRunLog(prisma, work.id, async () => {
    const counts = await writeRanks(prisma, matches, newHeadings, work.id);
    const summary = formatSummary(counts, [corpus]);
    console.log(summary);
    return { recordsImported: counts.ranked + counts.sinsCreated + counts.sinsUpdated, summary };
  });
}

function describe(match: SinMatch): string {
  if (match.status === 'none') return 'no كبيرة heading (rank stays null)';
  if (match.status === 'ambiguous') {
    return `AMBIGUOUS (${match.candidates.map((heading) => heading.number).join(', ')}) — rank stays null`;
  }
  return `${match.status} match: كبيرة ${match.heading?.number} «${match.heading?.nameAr}»`;
}

async function writeRanks(
  prisma: PrismaClient,
  matches: ReadonlyArray<{ sin: SinRow; match: SinMatch }>,
  newHeadings: readonly KabiraHeading[],
  rankSourceId: string,
): Promise<{ ranked: number; rankKept: number; sinsCreated: number; sinsUpdated: number }> {
  let ranked = 0;
  let rankKept = 0;
  for (const { sin, match } of matches) {
    if (!match.heading) continue;
    // A rank set by a curator from another source is never overwritten.
    if (sin.rank !== null && sin.rankSourceId !== rankSourceId) {
      rankKept += 1;
      continue;
    }
    await prisma.sin.update({
      where: { id: sin.id },
      data: { rank: SinRank.KABIRA, rankSourceId, rankReference: kabiraReference(match.heading) },
    });
    ranked += 1;
  }

  const existing = new Set(
    (await prisma.sin.findMany({ where: { slug: { startsWith: 'kabira-' } }, select: { slug: true } })).map((row) => row.slug),
  );
  let sinsCreated = 0;
  for (const heading of newHeadings) {
    const slug = kabiraSlug(heading.number);
    const rankFields = { rank: SinRank.KABIRA, rankSourceId, rankReference: kabiraReference(heading) };
    await prisma.sin.upsert({
      where: { slug },
      create: { slug, nameAr: heading.nameAr, name: KABIRA_ENGLISH_DRAFTS[heading.number] ?? '', ...rankFields },
      // The English draft may have been edited by the owner: only the cited Arabic and rank are importer-owned.
      update: { nameAr: heading.nameAr, ...rankFields },
    });
    if (!existing.has(slug)) sinsCreated += 1;
  }
  return { ranked, rankKept, sinsCreated, sinsUpdated: newHeadings.length - sinsCreated };
}
