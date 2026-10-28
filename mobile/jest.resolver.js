/**
 * Jest resolver: same rule as metro.config.js. Inside packages/practice-core a relative `./x.js` import
 * points at `./x.ts` (TypeScript source with `.js` specifiers). Everything else uses Jest's default resolver.
 */
const path = require('path');

const practiceCoreRoot = path.resolve(__dirname, '..', 'packages', 'practice-core');

function isInsidePracticeCore(dir) {
  if (!dir) return false;
  const rel = path.relative(practiceCoreRoot, dir);
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

module.exports = (request, options) => {
  if (request.startsWith('.') && request.endsWith('.js') && isInsidePracticeCore(options.basedir)) {
    try {
      return options.defaultResolver(`${request.slice(0, -3)}.ts`, options);
    } catch {
      // fall through
    }
  }
  return options.defaultResolver(request, options);
};
