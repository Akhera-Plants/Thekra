/**
 * Vitest globalSetup for e2e tests.
 *
 * Runs once in the main process before any workers start.
 * 1. Parses .env.test to find DATABASE_URL.
 * 2. Creates the test database if it does not exist.
 * 3. Runs `prisma migrate deploy` against the test database.
 *
 * Developers can also run steps 2-3 manually:
 *   psql postgresql://thekra:thekra_dev_password@localhost:5432/postgres -c 'CREATE DATABASE thekra_test;'
 *   DATABASE_URL=postgresql://...thekra_test... pnpm exec prisma migrate deploy
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

function parseEnvFile(filePath: string): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    const contents = readFileSync(filePath, 'utf8');
    for (const raw of contents.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      let value = line.slice(eqIdx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    }
  } catch {
    // file not found — caller handles missing value
  }
  return result;
}

export async function setup(): Promise<void> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const rootDir = resolve(__dirname, '..');
  const envPath = resolve(rootDir, '.env.test');

  const envVars = parseEnvFile(envPath);
  const databaseUrl = envVars['DATABASE_URL'] ?? process.env['DATABASE_URL'] ?? '';
  const directUrl =
    envVars['DIRECT_URL'] ?? process.env['DIRECT_URL'] ?? databaseUrl;

  if (!databaseUrl) {
    throw new Error(
      '[global-setup-e2e] DATABASE_URL not found in .env.test or process.env.\n' +
        'Copy .env.test.example → .env.test and fill in the values.',
    );
  }

  // Extract DB name and build an admin URL pointing to the postgres system database.
  // URL format: postgresql://user:pass@host:port/dbname?options
  const dbNameMatch = databaseUrl.match(/\/([^/?]+)(\?|$)/);
  const dbName = dbNameMatch?.[1] ?? 'thekra_test';
  const pgAdminUrl = databaseUrl.replace(/\/[^/?]+(\?.*)?$/, '/postgres');

  // 1. Create the test database (ignore error if it already exists)
  try {
    execSync(`psql "${pgAdminUrl}" -c "CREATE DATABASE \\"${dbName}\\""`, {
      stdio: 'pipe',
    });
    console.log(`[global-setup-e2e] Created database "${dbName}".`);
  } catch {
    // "database already exists" — this is the common case on re-runs
    console.log(`[global-setup-e2e] Database "${dbName}" already exists — skipping create.`);
  }

  // 2. Run pending migrations
  // Use the shell script directly (node_modules/.bin/prisma is a sh wrapper, not a JS file)
  console.log('[global-setup-e2e] Running prisma migrate deploy…');
  execSync('./node_modules/.bin/prisma migrate deploy', {
    cwd: rootDir,
    env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: directUrl },
    stdio: 'inherit',
    shell: '/bin/sh',
  });

  console.log('[global-setup-e2e] Test database ready.');
}
