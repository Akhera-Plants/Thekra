import type { PrismaClient } from '@prisma/client';

export interface ImportOptions {
  prisma: PrismaClient;
  dryRun: boolean;
  /** Pilot mode: import only the first N records. */
  limit: number | null;
}

export interface ParsedArgs {
  work: string;
  dryRun: boolean;
  limit: number | null;
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const positional = argv.filter((arg, index) => !arg.startsWith('--') && argv[index - 1] !== '--limit');
  const limitIndex = argv.indexOf('--limit');
  let limit: number | null = null;
  if (limitIndex !== -1) {
    limit = Number(argv[limitIndex + 1]);
    if (!Number.isInteger(limit) || limit < 1) throw new Error('--limit needs a positive integer');
  }
  const unknown = argv.filter((arg) => arg.startsWith('--') && arg !== '--dry-run' && arg !== '--limit');
  if (unknown.length > 0) throw new Error(`Unknown option(s): ${unknown.join(' ')}`);
  if (positional.length !== 1) throw new Error('Expected exactly one work name');
  return { work: positional[0] as string, dryRun: argv.includes('--dry-run'), limit };
}

export function applyLimit<T>(items: readonly T[], limit: number | null): readonly T[] {
  return limit === null ? items : items.slice(0, limit);
}

/** Picks `count` distinct random items (for the dry-run spot check). */
export function pickRandom<T>(items: readonly T[], count: number): T[] {
  const pool = [...items];
  const picked: T[] = [];
  while (picked.length < count && pool.length > 0) {
    const [item] = pool.splice(Math.floor(Math.random() * pool.length), 1);
    picked.push(item as T);
  }
  return picked;
}

export function preview(text: string, length = 120): string {
  return text.replace(/\s+/g, ' ').slice(0, length);
}
