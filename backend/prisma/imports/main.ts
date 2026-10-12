import { PrismaClient } from '@prisma/client';
import { runAdabMufradImport } from './adab-mufrad/import.js';
import { runTakhrij } from './sahihayn/import.js';
import { runKabairImport } from './kabair/import.js';
import { parseArgs, type ImportOptions } from './lib/cli.js';
import { runShuabImport } from './shuab/import.js';
import { runMinhajImport, runRiyadImport, runTarghibImport, runZuhdImport } from './waqfeya/import.js';

const WORKS: Record<string, (options: ImportOptions) => Promise<void>> = {
  shuab: runShuabImport,
  'adab-mufrad': runAdabMufradImport,
  kabair: runKabairImport,
  targhib: runTarghibImport,
  riyad: runRiyadImport,
  zuhd: runZuhdImport,
  minhaj: runMinhajImport,
  takhrij: runTakhrij,
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
