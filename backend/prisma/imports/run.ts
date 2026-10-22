/**
 * Book import runner (vision v2 §5.2):
 *
 *   pnpm --filter backend import:book <shuab|adab-mufrad|kabair> [--dry-run] [--limit N]
 *
 * Safety: refuses NODE_ENV=production unless IMPORT_ALLOW_PRODUCTION=true.
 */
import { registerHooks } from 'node:module';

if (process.env['NODE_ENV'] === 'production' && process.env['IMPORT_ALLOW_PRODUCTION'] !== 'true') {
  console.error('❌  Refusing to import: NODE_ENV=production. Set IMPORT_ALLOW_PRODUCTION=true to override.');
  process.exit(1);
}

// Sources use `.js` specifiers (nodenext, backend/.cursorrules); Node's type
// stripping does not map them to the `.ts` files, so fall back to `.ts` here.
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

const { main } = await import('./main.js');
process.exitCode = await main(process.argv.slice(2));
