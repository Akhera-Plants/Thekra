/**
 * The two Node APIs the tests use. The extension has no @types/node (it targets browsers and adds no
 * dependency for tests), so they are declared here.
 */
declare module 'node:fs' {
  export function existsSync(path: string | URL): boolean;
  export function readFileSync(path: string | URL, encoding: 'utf8'): string;
}
