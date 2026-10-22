# Deprecations and end-of-life audit

- **Audit date:** 2026-10-22 (local). **Scope:** `backend/`, `frontend/`, `mobile/` (mobile is not deployed), root tooling.
- **Re-run the guard:** `pnpm deprecations` (script: [scripts/check-deprecations.sh](../../scripts/check-deprecations.sh)). It prints outdated majors and matches the patterns below.
- **Environment:** Node 22.19.0, pnpm 11.7.0. The root `engines` field asks for Node `>=24` and CI uses 24; this audit did not re-run on Node 24.
- **Not changed by this audit:** no dependency was upgraded, no application code, Prisma schema, lockfile or `.github/workflows/ci.yml` was edited. The only repo change is the new `deprecations` script, its checker, and the docs.

## How each fact was obtained

Each finding below is tagged with the method that produced it.

- **[M1] Registry:** `pnpm outdated -r`, `pnpm ls --depth 0`, `npm view <pkg> dist-tags`, `npm view <pkg>@<installed> deprecated`.
- **[M2] Tool output:** `prisma validate`, `prisma generate`, `nest build`, `next build`, `oxlint --type-aware`, `eslint`, `tsc --noEmit`. Logs were saved under `/tmp/thekra-audit/`, outside the repo.
- **[M3] Docs:** installed docs and type declarations in `node_modules`, plus upstream pages fetched on 2026-10-22. Fetched pages were treated as data, not instructions.
- **[M4] Repo search:** `grep -rn` over the tree, with file reads for context.

## Summary

Effort: **S** = under half a day, mechanical; **M** = several files or packages, needs test runs; **L** = multi-package, runtime-behaviour risk, or a planned change.

| package | installed | current stable | what we use that is deprecated or removed next major | where (file:line) | breaks at which version | effort |
| --- | --- | --- | --- | --- | --- | --- |
| `prisma` (dev) | 6.19.3 | 7.10.1 (`8.0.0-rc.24` is a release candidate) | Generator `prisma-client-js`; datasource `url` / `directUrl` in the schema | `backend/prisma/schema.prisma:2`, `:7`, `:10` | 7.0 (`url`/`directUrl` deprecated; `prisma-client-js` removal announced) | M |
| `@prisma/client` | 6.19.3 | 7.10.1 | `new PrismaClient()` with no driver adapter, and the removed `datasources` option | `backend/src/prisma/prisma.service.ts:6`; `backend/prisma/seed.ts:44`; `backend/prisma/imports/main.ts:81`; `backend/prisma/imports/taxonomy/themes-report.ts:103`; `backend/test/fixtures/seed-test-fixtures.ts:95`; `backend/src/common/text/arabic-search.spec.ts:43` | 7.0 (driver adapter required) | M |
| `@prisma/client` | 6.19.3 | 7.10.1 | 131 files import from `@prisma/client`; the generated client moves out of `node_modules` to a required `output` | `backend/src`, `backend/test`, `backend/prisma` (`grep -rl "from '@prisma/client'"`) | 7.0 (generated path replaces `node_modules`) | M |
| `@types/helmet` (dev) | 4.0.0 | none (stub; `helmet` 8.3.0 ships its own types) | Stub types, deprecated on npm | `backend/package.json:62` | deprecated now | S |
| `eslint` (dev) | 9.39.5 | 10.13.0 | Release line 9.x is end-of-life | `frontend/package.json:41` | EOL 2026-08-06 (already past) | M |
| `zod` | 4.6.5 | 4.6.7 | `z.string().email()`, `z.string().uuid()` | `frontend/src/features/auth/components/LoginForm.tsx:24`, `RegisterForm.tsx:25`; `frontend/src/features/curation/components/QuoteForm.tsx:44`, `GoodDeedCrudView.tsx:62`, `SyncConsoleView.tsx:53` | `@deprecated` in installed 4.6.5; no removal version announced | S |
| `vitest` (frontend) | 3.2.7 | 5.0.5 | Two majors behind | `frontend/package.json:45` | 5.0 (Vite ≥ 6.4, Node ≥ 22.12 required) | M |
| `vitest` / `@vitest/coverage-v8` (backend) | 4.1.11 / 4.1.11 | 5.0.5 / 5.0.5 | `clearMocks` default changes; hoisted-mock rule becomes a throw | `backend/package.json:66`, `:76` | 5.0 | M |
| `@vitejs/plugin-react` (frontend, dev) | 4.7.0 | 6.1.2 | Declared but not imported anywhere (unused) | `frontend/package.json:40` | n/a (remove) | S |
| `typescript` | frontend 5.9.3; backend 6.0.3; mobile 6.0.3 | 7.0.2 | Backend tsconfig has no TS 6 deprecated options (`tsc` exit 0); frontend not yet checked against 6/7 | `frontend/package.json:44`; `backend/package.json:74`; `mobile/package.json:52` | 7.0 (native port) — verify with TS 7 notes | M |
| `next` | 16.3.8 | 16.4.2 (no Next 17 published) | None found: no removed Next 16 API in use | `frontend/package.json:21`; `frontend/src/proxy.ts` already uses the Next 16 `proxy` convention | n/a (minor update available) | S |
| `actions/checkout` (CI) | v4 | v7.0.1 | Action runtime `node20` | `.github/workflows/ci.yml:24` and 9 more (uncommitted owner edit; not touched) | Node 20 action runtime is superseded; v7 declares `node24` | S |
| `actions/setup-node` (CI) | v4 | not checked in this audit | Action runtime `node20` | `.github/workflows/ci.yml:26` and 7 more | same as above | S |
| `@types/node` | frontend 20.19.43; backend 24.19.1 | 26.6.5 | Not deprecated; frontend types lag the Node 24 target | `frontend/package.json:37`; `backend/package.json:63` | n/a | S |
| `pnpm` (`packageManager`) | 11.7.0 | 12.14.0 | Not a deprecation; a major exists | `package.json:6` | n/a | M (not evaluated) |
| mobile majors (expo 57→58, react-native 0.86→0.88, jest 29→30, i18next 24→26, react-i18next 15→17, react-native-gesture-handler 2→3) | see `pnpm outdated` | see `pnpm outdated` | Not evaluated in depth; mobile is not deployed | `mobile/package.json` | varies | L |

## Findings

### 1. Prisma 6.19.3 → 7.x (backend) — [M1][M2][M3][M4]

**Evidence**

- [M1] `pnpm outdated -r`: `@prisma/client 6.19.3 -> 7.10.1 [backend]`. The row `prisma 6.19.3 -> 8.1.0-dev.9` is a dev prerelease; the stable line is `npm view prisma dist-tags` → `prev: 7.10.1`, `latest: 8.0.0-rc.24`.
- [M2] `pnpm exec prisma validate` printed `The schema at prisma/schema.prisma is valid 🚀` with no deprecation output. `pnpm exec prisma generate` printed `Generated Prisma Client (v6.19.3) to ./../node_modules/.pnpm/@prisma+client@6.19.3…`. Prisma 6 does not warn about the v7 changes; the warnings only appear after the upgrade.
- [M3] Prisma v7 upgrade guide ([prisma.io/docs/guides/upgrade-prisma-orm/v7](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7)):
  - "The older `prisma-client-js` provider will be removed in future releases of Prisma ORM."
  - "The `output` field is now **required** in the generator block. Prisma Client will no longer be generated in `node_modules` by default."
  - "…other fields such as `url`, `directUrl`, and `shadowDatabaseUrl` in the `datasource` block are deprecated. You can configure them in the Prisma Config."
  - "The way to create a new Prisma Client has changed to require a driver adapter for all databases."
  - ESM: "Prisma ORM now ships as an ES module… Set the `type` field in your `package.json` to `module`."
- [M3] Release status ([prisma.io/docs/orm/release-status](https://www.prisma.io/docs/orm/release-status)): "Prisma ORM 8 is a **release candidate**", "`@prisma/client` … stays at `7.10.1`", "`npm install prisma` and `npx prisma` now give you the Prisma ORM 8 command-line tool, which does not read `schema.prisma`", and "Prisma ORM 6 receives security patches until 19 November 2026". The Prisma docs banner says "Prisma ORM 8 is here"; that conflicts with the release-status page and npm, so this audit treats 8 as an RC.
- [M4] Matches:
  - `backend/prisma/schema.prisma:2` `provider = "prisma-client-js"`; `:7` `url = env("DATABASE_URL")`; `:10` `directUrl = env("DIRECT_URL")`.
  - `backend/prisma.config.ts:5-25` hand-parses `.env` because "prisma.config.ts disables Prisma's automatic .env loading". It has no `datasource` block (`:27-33`).
  - `new PrismaClient(` with no adapter: `backend/prisma/seed.ts:44`, `backend/prisma/imports/main.ts:81`, `backend/prisma/imports/taxonomy/themes-report.ts:103`, `backend/test/fixtures/seed-test-fixtures.ts:95`, `backend/src/common/text/arabic-search.spec.ts:43` (which also passes the removed `datasources` option).
  - `backend/src/prisma/prisma.service.ts:6` `extends PrismaClient` with no adapter.
  - `backend/package.json:40` `"@prisma/client": "^6.19.3"`, `:71` `"prisma": "6.19.3"`.
  - `.github/workflows/ci.yml` (working tree) uses `SHADOW_DATABASE_URL` and `prisma migrate diff … --shadow-database-url` (lines 52, 74). The flag exists in 6.19.3 (`prisma migrate diff --help`); whether v7 keeps it is unverified.
  - `npx prisma` (unpinned) is not used anywhere in the repo (`grep` found none).

**Migration:** see [Prisma v7 upgrade plan](#prisma-v7-upgrade-plan-not-performed). Effort L overall; the schema and config part alone is M.

### 2. `@types/helmet` is a deprecated stub — [M1]

- `npm view @types/helmet@4.0.0 deprecated` → "This is a stub types definition. helmet provides its own type definitions, so you do not need this installed."
- `pnpm outdated -r` → `DEPRECATED @types/helmet 4.0.0 [backend]`.
- **Minimal step:** `pnpm --filter backend remove @types/helmet`, then `pnpm --filter backend exec tsc --noEmit -p tsconfig.json`. Helmet 8.3.0 ships its own types (verify by the tsc run).

### 3. ESLint 9 is end-of-life — [M1][M3]

- `npm view eslint@9.39.5 deprecated` → "This version is no longer supported. Please see https://eslint.org/version-support for other options."
- ESLint version support ([eslint.org/version-support](https://eslint.org/version-support/)): "ESLint v9.x reached end-of-life on 2026-08-06 and is no longer maintained."
- ESLint 10 migration ([eslint.org/docs/latest/use/migrate-to-10.0.0](https://eslint.org/docs/latest/use/migrate-to-10.0.0)): needs Node "v20.19.0 and above, v22.13.0 and above, v24 and above"; adds `no-unassigned-vars`, `no-useless-assignment` and `preserve-caught-error` to `eslint:recommended`; codemod `npx codemod @eslint/v9-to-v10`.
- Repo is already flat-config (`frontend/eslint.config.mjs`), so no legacy `.eslintrc` migration is needed. `eslint-config-next@16.4.2` declares `eslint >=9.0.0` (`npm view`).
- **Minimal step (planned):** bump `eslint` to `^10`, run `pnpm --filter frontend lint`, and fix new reports.

### 4. Zod 4 deprecated calls (frontend) — [M3][M4]

- Installed `frontend/node_modules/zod/v4/classic/schemas.d.ts:113` `/** @deprecated Use \`z.email()\` instead. */` and `:123` `/** @deprecated Use \`z.uuid()\` instead. */` (for `uuid`).
- Call sites: `LoginForm.tsx:24`, `RegisterForm.tsx:25` (email); `QuoteForm.tsx:44`, `GoodDeedCrudView.tsx:62`, `SyncConsoleView.tsx:53` (uuid).
- `z.nativeEnum` (`QuoteForm.tsx:42,53`; `TagCrudView.tsx:51`; `SourceCrudView.tsx:52`) is **not** tagged deprecated in 4.6.5, so it is not a finding.
- **Minimal step:** replace with `z.email()` and `z.uuid()`. Behaviour may differ on non-RFC UUID strings (not verified here), so run the frontend tests and check sample UUIDs in fixtures.

### 5. Vitest 3 (frontend) and 4 (backend) → 5 — [M1][M3][M4]

- Pins: `frontend/package.json:45` `"vitest": "^3"` (3.2.7 installed); `backend/package.json:76` `"vitest": "^4.1.2"` (4.1.11); `:66` `@vitest/coverage-v8` `^4.1.2`.
- Vitest 5 guide ([vitest.dev/guide/migration](https://vitest.dev/guide/migration)): "Vitest 5.0 requires Vite >= 6.4.0 and Node.js >= 22.12.0"; "`clearMocks` now defaults to `true`"; hoisted `vi.mock`/`vi.unmock`/`vi.hoisted` "Vitest 5.0 now throws" when not top-level; inline projects "inherit the root config by default".
- Repo check: `grep` finds no nested `vi.mock`, `vi.unmock` or `vi.hoisted` in `backend/src` or `backend/test`, so the throw does not hit today. The `clearMocks` change could affect specs that assert call counts across tests; not checked.
- **Minimal step (planned):** bump both packages together with `@vitest/coverage-v8`, set `clearMocks: false` if the behaviour change breaks specs, then run `pnpm test`.

### 6. Unused `@vitejs/plugin-react` (frontend) — [M1][M4]

- `frontend/package.json:40` `"@vitejs/plugin-react": "^4"`. Only the manifest references it; `frontend/vitest.config.ts` does not import it.
- **Minimal step:** `pnpm --filter frontend remove @vitejs/plugin-react` (lockfile change).

### 7. TypeScript 5.9 / 6.0 → 7.0 — [M1][M2][M3]

- `npm view typescript dist-tags` → `latest: 7.0.2`.
- Backend `pnpm exec tsc --noEmit -p tsconfig.json` exited 0 on TS 6.0.3 with no deprecation diagnostics; the backend tsconfig (`module: nodenext`, no `node10` resolution, no ES3/ES5 target) carries no TS-6 deprecated option. Frontend `tsc` was run on TS 5.9.3 (`frontend/tsconfig.json`: `moduleResolution: bundler`, `target: ES2017`); not checked against 6 or 7.
- TypeScript 6.0 announcement ([devblogs.microsoft.com/typescript/announcing-typescript-6-0](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/)) says TS 6 is "the bridge" to TS 7, a native port. The page was truncated before its deprecation list, so the specific TS 6 deprecations in the guard (`node10`, ES3/ES5 targets) are **unverified** and marked as such in the script.
- **Minimal step (planned):** move frontend to TS 6 first, run `tsc` and `next build`, then try TS 7 on a branch.

### 8. Next.js 16.3.8 — no deprecated usage found — [M2][M3][M4]

- Latest is 16.4.2 (`npm view next dist-tags`); no Next 17 release tag exists.
- Checked against the installed upgrade guide `frontend/node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`:
  - `next lint` removed (line ~1082): not used; `frontend/package.json:9` is `"lint": "eslint"`.
  - `serverRuntimeConfig` / `publicRuntimeConfig` removed (line ~1116): none.
  - `middleware` renamed to `proxy` (line ~612): `frontend/src/proxy.ts` already uses it; the installed `proxy.md` documents `export default function proxy` (line 272).
  - Single-argument `revalidateTag` deprecated (line ~444): none found.
  - `next/legacy/image` deprecated (line ~866): none found.
  - Async request APIs (line ~281): `await cookies()` in `frontend/src/app/api/auth/*/route.ts`; `await params` in every page that uses `params`.
- `next build` printed `Proxy (Middleware)` as a route label, with no warning.
- **Minimal step:** `pnpm update next eslint-config-next --filter frontend` to 16.4.2 after review (same major).

### 9. GitHub Actions running on the `node20` runtime — [M3]

- [`actions/checkout@v4`](https://raw.githubusercontent.com/actions/checkout/v4/action.yml) declares `runs: using: node20`. [`v7.0.1`](https://raw.githubusercontent.com/actions/checkout/v7.0.1/action.yml) declares `using: node24`.
- [`actions/setup-node@v4`](https://raw.githubusercontent.com/actions/setup-node/v4/action.yml) declares `using: 'node20'`.
- Where: `.github/workflows/ci.yml` working tree. Checkout at lines 24, 54, 81, 97, 135, 165, 177, 189, 199, 216; setup-node at 26, 56, 83, 99, 137, 190, 201, 218. `pnpm/action-setup@v4` was not checked.
- The file has uncommitted owner changes, so this audit did not edit it.
- **Minimal step (after the owner commits ci.yml):** bump `actions/checkout` to `v7`; check the latest major of `actions/setup-node` and `pnpm/action-setup` first.

### 10. Mobile (not deployed) — [M1]

- Major gaps from `pnpm outdated -r`: expo 57 → 58 (about 13 packages), react-native 0.86.3 → 0.88.0, react-native-gesture-handler 2.32 → 3.4, i18next 24.2.3 → 26.5.3, react-i18next 15.7.4 → 17.1.0, jest 29 → 30, @types/jest 29 → 30, typescript 6.0.3 → 7.0.2.
- React is 19.2.3 in mobile and 19.2.8 in frontend (`pnpm ls`). Not evaluated beyond the version gap. Low priority while mobile is not deployed.

### 11. Majors not audited in depth — [M1]

- `@hookform/resolvers` 5.9.1 → 6.0.0 (frontend). Its `npm view` peers include `zod ^4.0.0`. Release notes not read.
- `vite-tsconfig-paths` 5.1.4 → 6.1.1 (backend Vitest config).
- `@types/node`: frontend `^20` (installed 20.19.43) and backend `^24` (24.19.1) → 26.6.5. Frontend types lag the Node 24 target; aligning to 24.x is a planned change.
- `pnpm` 11.7.0 → 12.14.0 (`npm view pnpm dist-tags`). `packageManager` drives corepack in the Dockerfile and Vercel. Not evaluated.

### 12. Observations (not deprecations)

- Frontend shadcn UI files import `cn` from the npm package `cn@0.4.0`, not from a local helper: `frontend/src/components/ui/alert-dialog.tsx:4`, `tabs.tsx:5`, `card.tsx:2`. This is unusual for shadcn; confirm the intent.
- Backend `import:*` scripts and `prisma.config.ts:31` pass `--experimental-strip-types`. Node 22.19 accepts the flag with no warning (`node --experimental-strip-types t.ts` ran cleanly). It is redundant on current Node, so it is left as is.
- Root `engines` says Node `>=24`; the local Node is 22.19, and pnpm prints `Unsupported engine` on every run.
- `pnpm outdated` reports `prisma` latest as `8.1.0-dev.9`, a dev prerelease. The guard now labels prerelease targets.

## Zero-risk fixes made in this audit

None were needed. No `package.json` script or scripts-folder command uses a removed flag. Checked: `vitest --no-file-parallelism` (valid negation of `--fileParallelism`), `node --experimental-strip-types` (accepted), `nest deploy` (listed by `nest --help`, provided by Mau), `next typegen` (used in ci.yml), and `next lint` (absent). The only `package.json` edit is the new `deprecations` script.

## Safe to do now (no major bump; owner executes)

1. Remove the stub `@types/helmet` from `backend` (finding 2).
2. Replace the five Zod calls with `z.email()` / `z.uuid()` and run `pnpm --filter frontend exec vitest run` (finding 4).
3. Remove the unused `@vitejs/plugin-react` from `frontend` (finding 6).
4. Minor and patch updates within current majors, from `pnpm outdated -r` (review first): `next` and `eslint-config-next` 16.3.8 → 16.4.2; `@tanstack/react-query` 5.104.1 → 5.104.5; `zod` 4.6.5 → 4.6.7; `@nestjs/common`, `core`, `platform-express`, `testing` 12.1.2 → 12.2.0; `@nestjs/cache-manager` → 12.0.1; `@nestjs/jwt` → 12.0.3; `@nestjs/cli` → 12.0.10; `@nestjs/schematics` → 12.0.10; `lucide-react` 1.51.0 → 1.60.0; `react-hook-form` → 7.90.0; `shadcn` → 4.22.1; `oxlint` → 1.89.0; `prettier` → 3.9.10; `pino-pretty` → 13.2.0; `@playwright/test` → 1.64.1.
5. After the owner commits `ci.yml`: bump `actions/checkout` to `v7` (finding 9).

## Needs a planned upgrade

- **Prisma 7** (finding 1 and the plan below). Effort L.
- **ESLint 10** (finding 3). Effort M.
- **Vitest 5** for frontend and backend (finding 5). Effort M.
- **TypeScript 6, then 7** for frontend (finding 7). Effort M.
- **`@hookform/resolvers` 6**, **`vite-tsconfig-paths` 6**, **`@types/node` 24 alignment**, **`pnpm` 12** (finding 11). Effort S–M each; read their notes first.
- **Mobile majors** (finding 10). Effort L; mobile is not deployed.
- **Prisma 8** is a later step. Prisma says it is a release candidate with GA expected in October 2026, and Prisma 7 gets 18 months of fixes after 8 GA.

## Prisma v7 upgrade plan (not performed)

Target: `prisma@^7.10.1` and `@prisma/client@^7.10.1`. Do not target 8 (release candidate). Preconditions: Node ≥ 20.19 (ours is 24) and TypeScript ≥ 5.4 (backend is 6.0.3). Prisma recommends Node 22.x and TypeScript 5.9.x.

**Gate:** no migration SQL changes. `pnpm --filter backend exec prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma --exit-code` must still return 0. This is the same check CI runs.

1. **Packages (`backend/package.json`).** `pnpm --filter backend add @prisma/client@^7.10.1 @prisma/adapter-pg@^7.10.1` and `pnpm --filter backend add -D prisma@^7.10.1`. Both `prisma` and `@prisma/client` must stay on 7 (release status: "lock both packages to version 7"). Then `pnpm install --frozen-lockfile`. Keep the adapter on the same major. Check whether `pg` is needed as a direct dependency. If `pnpm why deepmerge-ts` shows `@prisma/config` 7 already on `deepmerge-ts` 8, drop the override in `pnpm-workspace.yaml` (its comment says so). Keep the `allowBuilds` entries for `prisma`, `@prisma/client` and `@prisma/engines` until a v7 install shows which build scripts are needed.

2. **Schema (`backend/prisma/schema.prisma`, lines 1–11).** Replace the generator and datasource blocks with:

   ```prisma
   generator client {
     provider     = "prisma-client"
     output       = "../src/generated/prisma"
     moduleFormat = "esm"
   }

   datasource db {
     provider = "postgresql"
     // URLs are configured in prisma.config.ts (CLI: DIRECT_URL; runtime: DATABASE_URL via the adapter).
   }
   ```

   - `output` sits under `src/` on purpose: `backend/tsconfig.build.json` sets `"include": ["src"]` and `rootDir: ./src`, so a client generated elsewhere (for example `backend/generated/`) is never emitted into `dist/`.
   - Root `.gitignore` already ignores `backend/generated/`; switch it to `backend/src/generated/`, and exclude the generated folder from oxlint and Prettier.
   - Verify the `moduleFormat` values and the generator field reference before committing; the guide only says it "supports ESM and CommonJS".

3. **Config (`backend/prisma.config.ts`).** Add a `datasource` block and keep `migrations`:

   ```ts
   datasource: {
     url: env('DIRECT_URL'),                       // Prisma CLI (migrate deploy/dev, db push): direct connection
     shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL, // optional, CI only; plain read so jobs without it still work
   },
   ```

   - The guide says the CLI uses the config `url` for migrations, so migrations move to `DIRECT_URL` (Neon non-pooled), the same as today's `directUrl`.
   - Use `env()` only for required variables. Verify whether `env()` throws when the variable is unset; if it does, every job that loads this config needs `DIRECT_URL` (see CI section).
   - The hand-written `.env` parser (`:5-25`) can stay. Alternatives are `process.loadEnvFile` (Node 20.12+, available on the repo's Node 22/24) or `dotenv`, which would be a new dependency and needs approval.

4. **Runtime client (`backend/src/prisma/prisma.service.ts`).** Construct the client with the adapter:

   ```ts
   import { PrismaPg } from '@prisma/adapter-pg';
   import { PrismaClient } from '../generated/prisma/client.js';
   // constructor(config: ConfigService) {
   //   super({ adapter: new PrismaPg({ connectionString: config.getOrThrow<string>('DATABASE_URL'), connectionTimeoutMillis: 5000 }) });
   // }
   ```

   - The guide notes the `pg` driver defaults to no connection timeout, while Prisma 6 used 5 s; `connectionTimeoutMillis: 5000` keeps v6 behaviour (verify option name in `@prisma/adapter-pg`).
   - The repo rule "only `PrismaService` imports `PrismaClient`" (`backend/.cursorrules`) still holds for services. The five scripts and specs in finding 1 each need the same adapter construction; `arabic-search.spec.ts` must drop `datasources`.

5. **Imports (131 files).** Replace `from '@prisma/client'` with the generated paths. Enums and the `Prisma` namespace come from the generated client; check the generated `models` and `enums` entry points after `prisma generate`. Confirm that `Prisma.PrismaClientKnownRequestError` and its `code` values (`P2025`, `P2002`) still behave the same, since `all-exceptions.filter.ts` and `chapter-maps.service.ts` depend on them.

6. **ESM and TypeScript.** The backend already emits ESM. `backend/package.json` has `"type": "module"`, `tsconfig.json` has `module: nodenext`, and `dist/main.js` (checked) uses `import` with `.js` specifiers. The "CommonJS build" premise does not match this repo. Implications:
   - The generated client is ESM with `moduleFormat = "esm"`. Under `nodenext`, its relative imports need `.js` extensions; generate, then run `tsc --noEmit` before anything else. Switching to `moduleResolution: bundler` (Prisma's example tsconfig) would not match Node's ESM runtime, so keep `nodenext` unless the generated output forces a change.
   - `nest build` (`tsconfig.build.json`) compiles the generated files into `dist/` because they sit under `src/`.
   - The `import:*` and `db:seed` scripts run TypeScript through `node --experimental-strip-types`. They only work if the generated client is erasable TypeScript (no enums, namespaces or parameter properties); verify by running each entry point against a throwaway database.

7. **Scripts and environment.** The `pnpm import:*`, `pnpm db:seed` and `prisma.config.ts` seed command all use `node --env-file=.env`. That needs a local `backend/.env` file (absent in CI and on Vercel), so these stay local-only tools. Run them only against a throwaway database after the upgrade; they write data.

8. **Verification gates, in order:** `pnpm prisma:validate`; `pnpm prisma:generate`; the drift check above; `pnpm --filter backend exec tsc --noEmit -p tsconfig.json`; `pnpm --filter backend test`; `pnpm --filter backend test:e2e` (against `thekra_test`); `pnpm --filter backend build` followed by a boot smoke test of `node dist/main.js` with `DATABASE_URL` set; `pnpm deprecations` (the allowlist entries for the Prisma items must be removed in the same change).

9. **Rollback.** Revert the package, lockfile, schema, config and source changes in one commit. No database object changes, so rollback is code-only.

## CI and deploy implications (for the planned change; not applied)

- **CI (`.github/workflows/ci.yml`, owner's uncommitted file).**
  - Workflow-level `DATABASE_URL` and `DIRECT_URL` (lines 17–18, already in the owner's working tree) satisfy the config's requirements. Keep them, because `prisma.config.ts` reads them and `prisma.config.ts` is loaded by every Prisma CLI command.
  - The `lint` job runs `oxlint --type-aware` without `prisma generate`. Once the generated client is required by imports, add `pnpm prisma:generate` to that job.
  - The `prisma` job's `--shadow-database-url` flag must be re-checked on v7, or the value moved to `datasource.shadowDatabaseUrl`.
  - `test-e2e` writes `backend/.env.test` with `DATABASE_URL` only; `global-setup-e2e.ts` passes `DIRECT_URL` to `prisma migrate deploy`, which keeps that path working.
  - `actions/checkout@v4` and `actions/setup-node@v4` run `node20` (finding 9).
  - Once it exists, add `pnpm deprecations` to a CI job.
- **Vercel (`docs/deploy/VERCEL.md`, `backend/vercel.json`).**
  - Build command `pnpm exec prisma generate && pnpm exec prisma migrate deploy && pnpm run build` stays. `migrate deploy` now reads `datasource.url`, which is `DIRECT_URL`; VERCEL.md §3 already requires `DIRECT_URL` in the backend project.
  - Runtime uses `DATABASE_URL` (Neon pooled) through the adapter. Document both in VERCEL.md §3 in the same change.
  - `installCommand` uses `--frozen-lockfile`, so the upgraded lockfile must be committed first.
  - Confirm with a preview deploy that the generated client is included in the function bundle; the Render fallback needs the same check and the Dockerfile must copy `dist/`, which already includes it.

## Checks not run, and limits

- The Prisma v7 `migrate diff --shadow-database-url` flag, the `env()` throw behaviour, the `moduleFormat` values, and the `@prisma/adapter-pg` option names are **unverified** until the upgrade branch runs them.
- TypeScript 6's full deprecation list was not retrieved (truncated page). The `node10` and ES3/ES5 checks in the guard are marked unverified.
- Frontend `tsc` and tests ran on TS 5.9; no TS 6/7 run was attempted.
- Node 24 was not used locally; CI behaviour on Node 24 is not confirmed by this audit.
- Mobile was checked only through registry metadata.
