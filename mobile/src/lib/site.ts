/**
 * Public web site that shared links point to (PROJECT_GUIDE §1). A constant on purpose: a new
 * `EXPO_PUBLIC_*` variable would have to be added to CI, backend/.env.example and docs/deploy/VERCEL.md
 * (AGENTS.md), which this app does not need for one fixed public address.
 */
export const SITE_URL = 'https://thekra-web.vercel.app';
