/**
 * Metro config (Expo SDK 57).
 *
 * Base: `getDefaultConfig` from `expo/metro-config` (@expo/metro-config 57), as its README shows. In a pnpm
 * workspace it already adds the workspace packages to `watchFolders` (getWatchFolders reads
 * pnpm-workspace.yaml); we add packages/practice-core explicitly as well so the app keeps bundling if that
 * detection changes, and because the app will later move to its own repository.
 *
 * `@thekra/practice-core` ships TypeScript source (no build step) and its relative imports use `.js`
 * specifiers that point at `.ts` files (`./dates.js` → `src/dates.ts`). TypeScript and esbuild accept this;
 * Metro does not. The resolver below retries such an import with `.ts`, **only** for files inside
 * packages/practice-core, then falls back to Metro's own resolution through `context.resolveRequest` (the
 * chaining Metro documents and Expo CLI's withMetroResolvers relies on).
 */
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');
const practiceCoreRoot = path.resolve(workspaceRoot, 'packages', 'practice-core');

const config = getDefaultConfig(projectRoot);

config.watchFolders = Array.from(new Set([...(config.watchFolders || []), practiceCoreRoot]));

function isInsidePracticeCore(filePath) {
  if (!filePath) return false;
  const rel = path.relative(practiceCoreRoot, filePath);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

const upstreamResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = upstreamResolveRequest || context.resolveRequest;
  if (
    moduleName.startsWith('.') &&
    moduleName.endsWith('.js') &&
    isInsidePracticeCore(context.originModulePath)
  ) {
    try {
      return resolve(context, `${moduleName.slice(0, -3)}.ts`, platform);
    } catch {
      // No .ts sibling: resolve the specifier as written.
    }
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
