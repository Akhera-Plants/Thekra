/**
 * Turbopack loader for @thekra/practice-core (wired in next.config.ts `turbopack.rules`).
 *
 * The package is TypeScript source whose relative imports end in `.js` (`./dates.js`), the form its README
 * requires so the backend's `nodenext` build and esbuild accept it. Turbopack in Next 16.3 does not map a
 * `.js` specifier to the `.ts` file beside it (`experimental.extensionAlias` is webpack-only), so this
 * drops the extension from relative specifiers and lets normal resolution find `./dates.ts`.
 * The package itself is not changed.
 */
const RELATIVE_JS_SPECIFIER = /(\bfrom\s+['"])(\.{1,2}\/[^'"]+?)\.js(['"])/g;

module.exports = function practiceCoreSpecifiers(source) {
  return source.replace(RELATIVE_JS_SPECIFIER, '$1$2$3');
};
