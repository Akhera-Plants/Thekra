// Vercel Function: every path is rewritten here (backend/vercel.json).
// The handler comes from the esbuild bundle that `pnpm build` produces; see
// scripts/bundle.mjs and docs/deploy/VERCEL.md.
export { default } from '../dist/bundle/serverless.mjs';
