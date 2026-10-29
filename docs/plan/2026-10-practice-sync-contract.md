# Practice data: accounts, tables, sync and the encrypted sin vault

> Owner decisions, 2026-10-28: accounts are turned on; habits, kinship and settings live in the database in their own
> tables and stay in step across the web app, the browser extension and the mobile app; the sin-leaving program is
> stored so that nobody — not even us — can tell which sin it is or read its notes. This replaces the JSON blob
> (`UserPracticeStore`) from commit 6b7db04, which was never deployed or applied to any database.

## 1. Principles

- **Offline first.** Every client keeps a full local copy (practice-core `Store`) and works without a network or an
  account. Signing in turns on sync; signing out keeps the local copy.
- **The server is the meeting point, not the source of truth for one device.** Sync is incremental (`since`), merge
  rules are commutative so the order of devices does not matter.
- **The sin program never reaches the server in clear.** It is encrypted on the device with a key derived from a
  «رمز الخصوصية» (privacy code) the user chooses. The server stores an opaque blob. A forgotten code means the
  program cannot be recovered (the UI says so before the user sets it). Hashing the sin slug is not used: with ~90
  sins a hash is trivially reversed by trying them all.
- No practice data in logs, analytics, error messages or CDN caches (`private, no-store`).

## 2. Tables (Prisma, one additive migration)

| Model | Columns | Notes |
| --- | --- | --- |
| `PracticeSettings` | `userId` PK→User (cascade), `hijriOffset Int @default(0)`, `reminderTimes String[]`, `freeMinutesPerDay Int?`, `updatedAt DateTime` | one row per user |
| `HabitPlan` | `id String @id` (client UUID), `userId`→User (cascade), `habitKey String?`, `deedSlug String`, `title String`, `unit String` (`minutes`/`count`/`times`), `amount Int`, `ceiling Int?`, `activeDaysPerWeek Int`, `slots String[]`, `rule Json?`, `createdOn @db.Date`, `amountChangedOn @db.Date`, `ebbSince @db.Date?`, `season Json?`, `clientUpdatedAt DateTime`, `updatedAt DateTime @updatedAt`, `deletedAt DateTime?` | `@@index([userId, updatedAt])`; max 50 live plans per user |
| `HabitLog` | `planId`→HabitPlan (cascade), `date @db.Date`, `amount Float`, `correctedAt DateTime?`, `updatedAt DateTime @updatedAt` | `@@id([planId, date])` |
| `Relative` | `id String @id` (client UUID), `userId`→User (cascade), `name String`, `relation String`, `rule Json`, `lastContactedOn @db.Date?`, `clientUpdatedAt DateTime`, `updatedAt @updatedAt`, `deletedAt DateTime?` | max 200 live per user; name/relation rejected by `looksLikeContactDetails` |
| `RelativeContact` | `relativeId`→Relative (cascade), `date @db.Date`, `deletedAt DateTime?`, `updatedAt @updatedAt` | `@@id([relativeId, date])`; undo = tombstone |
| `SinVault` | `userId` PK→User (cascade), `ciphertext String` (base64), `iv String` (base64, 12 bytes), `salt String` (base64, 16 bytes), `kdf String` (`pbkdf2-sha256`), `iterations Int`, `version Int @default(0)`, `updatedAt @updatedAt` | ≤ 128 KB ciphertext |

Dates on the wire are `YYYY-MM-DD`; timestamps are ISO 8601 UTC.

## 3. Sync API (all JWT, `private, no-store`, throttled like other user routes)

### `GET /v1/me/practice?since=<ISO>` → changes after `since` (everything when absent)

```json
{ "data": {
  "serverTime": "2026-10-28T18:00:00.000Z",
  "settings": { "hijriOffset": 0, "reminderTimes": ["07:00"], "freeMinutesPerDay": 60, "updatedAt": "…" } | null,
  "plans": [ { "id": "…", "habitKey": "duha", "deedSlug": "nawafil", "title": "…", "unit": "times", "amount": 1,
               "ceiling": null, "activeDaysPerWeek": 3, "slots": ["09:30","11:00"], "rule": {…}|null,
               "createdOn": "2026-10-28", "amountChangedOn": "2026-10-28", "ebbSince": null, "season": null,
               "clientUpdatedAt": "…", "deletedAt": null } ],
  "logs": [ { "planId": "…", "date": "2026-10-28", "amount": 1 }, { "planId": "…", "date": "2026-10-27", "amount": 0, "correctedAt": "<ISO>" } ],
  "relatives": [ { "id": "…", "name": "…", "relation": "…", "rule": {…}, "lastContactedOn": null,
                   "clientUpdatedAt": "…", "deletedAt": null } ],
  "contacts": [ { "relativeId": "…", "date": "2026-10-20", "deleted": false } ]
} }
```

### `POST /v1/me/practice/sync` → apply local changes, return everything changed since `since`

Body: `{ "since": "<ISO>|null", "changes": { "settings"?: {…, "clientUpdatedAt"}, "plans": [...], "logs": [...],
"relatives": [...], "contacts": [...] } }` with at most 500 items in total. Response: same shape as GET, computed
after applying, with `since` = the request's `since`.

Merge rules (server and practice-core apply the same ones):

| Kind | Rule |
| --- | --- |
| plan, relative, settings | last writer wins by `clientUpdatedAt`; a tombstone (`deletedAt`) also carries `clientUpdatedAt` and wins only when newer |
| log (plan, date) | the later `correctedAt` wins (absent/null counts as the oldest); at the same `correctedAt` the larger amount wins. So plain logging never goes down (same-day partial amounts add up on the device first), and an undo of «تمّ» or a fixed amount (practice-core `correctLog`, which sets `correctedAt`; `amount` may then be 0) is not undone by a device that still holds the old amount. Added 2026-10-29 (`HabitLog.correctedAt`); a client that never sends `correctedAt` keeps the old max rule |
| contact (relative, date) | union; `deleted: true` sets a tombstone; a later non-deleted write clears it |

Validation: practice-core `validatePlan` / `validateRule` / `validateRelative` / `looksLikeContactDetails`; unknown
fields are dropped; a log for a plan the user does not own is rejected (404 for the whole request, nothing applied).
Errors: 400 `PRACTICE_INVALID` (with the item index), 413 `PRACTICE_TOO_LARGE`, 422 `PRACTICE_LIMIT_REACHED`.
Requests that contain a `programs` key anywhere → 400 `PRACTICE_PROGRAMS_NOT_ALLOWED`.

After a sync that carried changes, the user's web push reminders are re-planned (docs/plan/2026-10-web-push.md);
a failure there is logged and never fails the sync.

### Sin vault

- `GET /v1/me/sin-vault` → `{ data: { vault: { ciphertext, iv, salt, kdf, iterations, version, updatedAt } | null } }`
- `PUT /v1/me/sin-vault` body `{ ciphertext, iv, salt, kdf, iterations, version }` → `{ data: { version } }`; stale
  `version` → 409 `SIN_VAULT_CONFLICT` with the current vault in `details`. The server checks only base64 shape, sizes,
  `kdf === 'pbkdf2-sha256'` and `iterations >= 210000`.
- `DELETE /v1/me/sin-vault` → 204.

Export (`GET /v1/auth/me/export`) includes settings, plans, logs, relatives, contacts and the vault **ciphertext**
(still unreadable). `DELETE /v1/auth/me` cascades everything.

## 4. Client side (practice-core)

- `Store` v2: plans and relatives carry `updatedAt` (client ISO time of the last local edit); `tombstones`
  `{kind, id, deletedAt}`; contact undo is a tombstone; `sync: { lastSyncedAt }`. `parseStore` upgrades v1 → v2.
- `localChanges(store)` → the `changes` body (items edited after `lastSyncedAt`); `applyServerChanges(store,
  response)` → new store with the merge rules above and `lastSyncedAt = serverTime`.
- `vault.ts`: `deriveKey(code, salt, iterations = 210000)` (PBKDF2-SHA256, 32 bytes), `sealPrograms(programs, key)`
  → `{ciphertext, iv}` with AES-256-GCM and a fresh 12-byte IV, `openPrograms(vault, key)`; built on
  `@noble/hashes` and `@noble/ciphers` (audited, pure JS, the same code on web, extension and Hermes). Random bytes
  come from `globalThis.crypto.getRandomValues` (mobile installs it with `expo-crypto`).
- The unlocked key is kept in memory for the session; the user may choose «تذكّر على هذا الجهاز» (web: IndexedDB
  non-extractable `CryptoKey` is not available for noble, so the raw key is stored only in the device keystore on
  mobile — `expo-secure-store` — and is not offered on the web).

## 5. Clients

| Client | Sign-in | Synced | Sin program |
| --- | --- | --- | --- |
| Web | existing JWT auth, turned on (`NEXT_PUBLIC_ACCOUNTS_ENABLED=true` on Vercel) | settings, plans, logs, relatives, contacts | encrypted vault, unlocked with the privacy code |
| Mobile | existing login | same | same, with optional keystore remember |
| Extension | email + password in the popup (token in `chrome.storage.local`) | plans and logs only | not in the extension |

Sync runs on sign-in, on app focus, after a local edit (debounced 3 s) and every 15 minutes while open.
