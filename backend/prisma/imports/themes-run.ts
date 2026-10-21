/**
 * Topic themes reviewer tool (read-only): pnpm taxonomy:themes [--propose] [--topic slug]
 * See taxonomy/themes-report.ts.
 */
import { registerHooks } from 'node:module';

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

await import('./taxonomy/themes-report.js');
