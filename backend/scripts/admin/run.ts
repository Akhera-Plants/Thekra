/**
 * Entry for `pnpm --filter backend admin:create`:
 *
 *   DATABASE_URL=… ADMIN_EMAIL=… ADMIN_PASSWORD=… pnpm --filter backend admin:create
 *
 * Does not read backend/.env: the target database must be set explicitly.
 */
import { registerHooks } from 'node:module';

// Snapshot before anything imports @prisma/client, which loads backend/.env
// into process.env and would silently supply the local DATABASE_URL.
const env = { ...process.env };

// Sources use `.js` specifiers (nodenext); Node's type stripping does not map
// them to the `.ts` files, so fall back to `.ts` (same hook as prisma/imports/run.ts).
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

const { main } = await import('./create-admin.js');
process.exitCode = await main(env);
