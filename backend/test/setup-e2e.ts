/**
 * Vitest setupFile for e2e tests.
 *
 * Runs in each worker before the test file is evaluated.
 * Parses .env.test and injects variables into process.env (only if not already set),
 * so DATABASE_URL points to thekra_test before any module's PrismaClient is constructed.
 *
 * No new dependencies — uses Node's built-in `fs` module.
 */

import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { assertTestDatabase } from './helpers/assert-test-database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = resolve(__dirname, '../.env.test');

try {
  const contents = readFileSync(envPath, 'utf8');
  for (const raw of contents.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Only set if not already set — CI may inject vars directly
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
} catch {
  // .env.test not found — CI should inject vars directly
  console.warn('[setup-e2e] .env.test not found; relying on existing process.env');
}

assertTestDatabase(process.env['DATABASE_URL']);
