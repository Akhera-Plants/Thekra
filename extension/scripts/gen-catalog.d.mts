export const CATALOG_OUT: string;
export function pickHabits(raw: unknown): Record<string, unknown>[];
export function generateCatalog(): Promise<{ source: string; count: number }>;
