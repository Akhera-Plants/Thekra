import { PrismaClient } from '@prisma/client';
import { runAdabMufradImport } from './adab-mufrad/import.js';
import { publishSahihayn } from './sahihayn/publish.js';
import { runTakhrij } from './sahihayn/import.js';
import { runKabairImport } from './kabair/import.js';
import { parseArgs, type ImportOptions } from './lib/cli.js';
import { runShuabImport } from './shuab/import.js';
import { runShuabRematchPrep, runShuabRematchPropagate } from './shuab/rematch.js';
import { runAtharClassifyImport } from './athar/classify-import.js';
import { runClassify } from './classify/import.js';
import { runQuranImport } from './quran/import.js';
import { runAshurImport } from './tafsir/ashur-import.js';
import { runIbnKathirEnImport } from './tafsir/ibn-kathir-en.js';
import { runSadiImport } from './tafsir/sadi.js';
import { runMukhtasarImport } from './tafsir/mukhtasar.js';
import { runDigitalImport } from './digital/import.js';
import { runStructureImport } from './structure/import.js';
import { runTaxonomyImport } from './taxonomy/import.js';
import { runSunanTahqiq } from './sunan-tahqiq/import.js';
import { runTranslations } from './translations/import.js';
import { runIbnRajab } from './ibn-rajab/import.js';
import { runIbnAbiDunyaImport } from './ibn-abi-dunya/import.js';
import { runHadeethencImport } from './hadeethenc/import.js';
import { runMinhajImport, runRiyadImport, runTarghibImport, runZuhdImport } from './waqfeya/import.js';

const WORKS: Record<string, (options: ImportOptions) => Promise<void>> = {
  shuab: runShuabImport,
  'shuab-matn': async ({ prisma }) => {
    await runShuabRematchPrep(prisma);
  },
  'shuab-propagate': async ({ prisma }) => {
    await runShuabRematchPropagate(prisma);
  },
  athar: runAtharClassifyImport,
  'adab-mufrad': runAdabMufradImport,
  kabair: runKabairImport,
  targhib: runTarghibImport,
  riyad: runRiyadImport,
  zuhd: runZuhdImport,
  minhaj: runMinhajImport,
  digital: runDigitalImport,
  takhrij: runTakhrij,
  sahihayn: publishSahihayn,
  quran: runQuranImport,
  classify: runClassify,
  structure: runStructureImport,
  taxonomy: runTaxonomyImport,
  'sunan-tahqiq': runSunanTahqiq,
  translations: runTranslations,
  'ibn-rajab': runIbnRajab,
  'ibn-abi-dunya': runIbnAbiDunyaImport,
  sadi: runSadiImport,
  mukhtasar: runMukhtasarImport,
  ashur: runAshurImport,
  'ibn-kathir-en': runIbnKathirEnImport,
  hadeethenc: runHadeethencImport,
};

const USAGE = `usage: import:book <${Object.keys(WORKS).join('|')}> [--dry-run] [--limit N]`;

export async function main(argv: readonly string[]): Promise<number> {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    console.error(`${error instanceof Error ? error.message : String(error)}\n${USAGE}`);
    return 2;
  }
  const run = WORKS[args.work];
  if (!run) {
    console.error(`Unknown work "${args.work}"\n${USAGE}`);
    return 2;
  }

  const prisma = new PrismaClient();
  try {
    await run({ prisma, dryRun: args.dryRun, limit: args.limit });
    return 0;
  } catch (error) {
    console.error('❌  Import failed:', error instanceof Error ? error.message : error);
    return 1;
  } finally {
    await prisma.$disconnect();
  }
}
