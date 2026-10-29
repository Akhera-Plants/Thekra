# @thekra/practice-core

Shared engine for Thekra's reminders, habit plans («أعِنّي على طاعة»), sin-leaving program («ترك المعصية») and
kinship list (صلة الرحم), plus account sync and the encrypted sin vault. Pure TypeScript, ESM, no build step
(`exports` points at `src/index.ts`). Runtime dependencies: `@noble/hashes` and `@noble/ciphers` (audited, pure JS,
pinned at 2.4.0), used only by the vault. Meant for the web app (Next.js `transpilePackages`), the browser extension (esbuild), the mobile
app (Expo/Metro) and the backend (esbuild bundle). Plan: [docs/plan/2026-10-features-roadmap.md §1](../../docs/plan/2026-10-features-roadmap.md).

```sh
pnpm --filter @thekra/practice-core test       # vitest run
pnpm --filter @thekra/practice-core typecheck  # tsc --noEmit
```

## Conventions

- Calendar days are local `YYYY-MM-DD` strings and times are `HH:MM`. The API never takes a `Date` for a day; call
  `todayFrom(new Date())` once at the edge of the app. Arithmetic is time-zone and DST independent.
- Every function is pure: inputs are never mutated, new objects are returned.
- Only ES2022 plus `Intl.DateTimeFormat` with the `islamic-umalqura` calendar. No Node or DOM APIs, except
  `globalThis.crypto.getRandomValues` in the vault (React Native: `expo-crypto`).
- Edit times (`updatedAt`, tombstones) are ISO UTC strings. Every helper that stamps one takes `now` (default
  `new Date().toISOString()`) so tests stay deterministic.
- Relative imports use `.js` specifiers (`./dates.js`), which bundlers, `moduleResolution: bundler` and the backend's `nodenext` all accept.

## Modules

| Module | API |
| --- | --- |
| `dates` | `isValidDate`, `isValidTime`, `addDays`, `diffDays`, `weekday` (0 = Sunday), `compareDates`, `minDate`/`maxDate`, `eachDay`, `todayFrom`, `timeToMinutes` |
| `hijri` | `toHijri(date, offsetDays = 0)`, `hijriMonthNameAr(month)`, `formatHijriAr(date, offset)` → «17 جمادى الأولى 1448 هـ», `isHijriSupported()` |
| `rules` | `Rule` union (`daily`, `weekdays`, `everyNDays`, `everyNWeeks`, `monthlyDay`, `hijriMonthDays`, `hijriYearly`, `hijriWindow`), `occurrences(rule, from, to, {hijriOffset})`, `nextOccurrences(rule, from, count, opts)`, `isDue`, `validateRule` |
| `ics` | `buildIcs({calendarName, events, prodId?, now?})`, `occurrencesToEvents(rule, from, to, base, opts)`, `escapeText`, `foldLine` |
| `plan` | `createPlan`, `LADDER`, `startSuggestion`, `nextStep`, `canIncrease`, `increase`, `decreaseTo`, `requiredOn`, `logDone`, `targetDaysIn`, `adherence`, `adherenceBand`, `status`, `relapseSuggestion`, `startEbb`/`endEbb`, `startSeason`, `normalize`, `dailyLoad`, `loadWarning`, `validatePlan` |
| `sin-program` | `startProgram`, `pathFor`, `stagesFor`, `checkIn`, `currentStage`, `summary`, `afterFall`, `validateProgram` |
| `kinship` | `createRelative`, `nextDue`, `dueList`, `logContact`, `undoLastContact`, `looksLikeContactDetails`, `validateRelative` |
| `storage` | `Store` (`v: 2`), `emptyStore`, `parseStore(json, now?)` (never throws, drops invalid entries, upgrades v1), `serializeStore`, `exportForSync` (no `programs`), `upsertPlan`/`updatePlan`/`deletePlan`, `upsertRelative`/`updateRelative`/`deleteRelative`, `undoContact`, `updateSettings`, `contactId` |
| `sync` | `localChanges(store, {maxItems?, includeAcked?})`, `buildSyncRequest`, `applyServerChanges(store, response)`, `countChanges`, `compareVersions`, `mergeLogAmount`, wire types (`SyncChanges`, `SyncResponse`, `WirePlan`…) |
| `vault` | `deriveKey(code, salt, iterations = 210000)`, `newSalt`, `sealPrograms`, `openPrograms`, `unlockVault`, `vaultPayload`, `VaultError`, `VaultLockedError` |
| `base64` | `bytesToBase64`, `base64ToBytes` (strict) |
| `tazkiya` | Private journal (`TazkiyaJournal` v1, device only, never synced): `emptyJournal`, `parseJournal` (never throws), `serializeJournal`, `setNiyyah`, `setMuhasaba`, `deleteDay`, `notebook` (newest first), `intendedPlan`, `dismiss`/`promptKey`, `duePrompt` (intention 04:00 to 12:00, evening from Maghrib or 18:00), `celebrationLine` |
| `fresh-start` | `freshStarts(date, hijriOffset)` (ten days of Dhu al-Hijja, Sha'ban, Hijri month days 1 to 3, Friday, Monday, in that order), `freshStartFor` (one card, not set aside), `freshStartKey`, `freshStartAction` (`increase` via `canIncrease`, `start`, or `renew`) |

### Hijri

Umm al-Qura through `Intl` (verified on Node 22: 2026-10-28 = 17 Jumada al-Ula 1448; 1 Ramadan 1447 = 2026-02-18).
`offsetDays` (−2…+2) is added to the Gregorian date before conversion: `−1` means the local month starts one day
later than Umm al-Qura. If a runtime silently falls back to Gregorian, `isHijriSupported()` is false and `toHijri`
throws, so the app can hide Hijri features instead of showing a wrong Arafah date. Check it on Hermes before
shipping the mobile app.

### ICS

RFC 5545 with CRLF, folding at 75 UTF-8 octets (never splitting a character), TEXT escaping, all-day events as
`VALUE=DATE`, timed events in floating local time, `DTSTAMP` in UTC from `now`, optional `VALARM`.
**No `RRULE`**: RFC 5545 recurrence is Gregorian only, so Hijri rules cannot be expressed. Expand any rule into
explicit events with `occurrencesToEvents` (e.g. the next 12 months) and re-export later. Titles appear on lock
screens and in Google/Apple calendars: pass a generic title («تذكرة من ذكرى») for anything private (roadmap §0.2).

### Store v2

`{ v: 2, plans, relatives, programs, settings, tombstones, sync: { lastSyncedAt, acked } }`
(docs/plan/2026-10-practice-sync-contract.md §4).

- Plans and relatives carry `updatedAt`, the last-writer-wins version of their own fields. Entity helpers that
  change those fields stamp it (`createPlan`, `increase`, `decreaseTo`, `startEbb`, `endEbb`, `startSeason`,
  `createRelative`). `logDone`, `logContact`, `undoLastContact` and `normalize` do not: logs and contacts sync per
  day on their own, and a season's end is derived from the date. Stamping them would let a log overwrite a plan
  edit made on another device.
- `tombstones` record deleted plans and relatives and undone contacts (`id` = `${relativeId}|${date}`). A plan
  tombstone keeps the plan's log, so a newer edit from another device that restores the plan restores its log too.
- Edit a store through the store helpers (`updatePlan`, `deletePlan`, `updateRelative`, `undoContact`,
  `updateSettings`…). They stamp `updatedAt` when the versioned fields change and write the tombstones, even when
  the change came from an entity helper.
- `parseStore` upgrades v1: plans and relatives get `updatedAt = now`, and so do settings that differ from the
  defaults. Default settings stay unversioned so a synced choice wins over them.

### Sync

`localChanges` builds the `changes` of `POST /v1/me/practice/sync`, using the contract's wire shapes.
`applyServerChanges` merges a response (or a `GET` body) and sets `sync.lastSyncedAt = serverTime`, the next
`since`. It uses the server's merge rules:

| Kind | Rule |
| --- | --- |
| plan, relative, settings | last writer wins by `clientUpdatedAt`, tombstones included. At equal times a tombstone wins, then the larger canonical JSON, so every replica picks the same winner |
| log (plan, date) | `max(stored, incoming)` |
| contact (relative, date) | union. `deleted: true` removes the contact and a later live write restores it. A local change not pushed yet is kept, because it is the later write |

- Pending items are found by version, not by clock. `sync.acked` stores the version of each item the server
  returned; an item whose current version differs is sent. So an edit on a device with a wrong clock still goes
  out, and a large first sync can go out in several requests: `maxItems` defaults to 500 (the contract's limit),
  and every plan and relative goes before any log or contact.
- A deleted plan or relative is sent as `{ id, clientUpdatedAt, deletedAt }` with no other fields.
- No body ever contains `programs`, a sin slug or a note.

### Vault

The sin program (slug, check-ins and notes) leaves the device only inside the vault:

- PBKDF2-HMAC-SHA256 (210,000 iterations, 16-byte salt) turns the «رمز الخصوصية» into a 32-byte key. The code is
  normalized to NFC first.
- The programs are encrypted with AES-256-GCM, using a fresh 12-byte IV for every seal.
- The plaintext is padded to a multiple of 1 KB, so the ciphertext length does not hint at which sin it holds.
- `vaultPayload` builds the `PUT /v1/me/sin-vault` body and refuses fewer than 210,000 iterations.
- `unlockVault(vault, code)` returns the programs and the key, to keep in memory for the session.
- A wrong code or changed data throws `VaultLockedError`. Malformed input throws `VaultError`. A forgotten code
  cannot be recovered.
- The output is standard AES-GCM (ciphertext followed by the 16-byte tag). The tests decrypt it with WebCrypto.

## Product rules (from the lecture)

Source: [docs/research/anas-sheikh-akrim/4EkrbmmIlno-analysis.md](../../docs/research/anas-sheikh-akrim/4EkrbmmIlno-analysis.md)
§4 (numbers) and §5 (leaving sins). Line numbers (س) refer to the transcript.

| Rule | In code |
| --- | --- |
| Start very small: 2 min if far, 5 if near (س 858–867) | `startSuggestion('far' \| 'near')` |
| Hold the start about a month (س 863–866) | `HOLD_DAYS = 28` before `canIncrease` |
| Climb one small step: 5 → 7 → 10 → 15 (س 889–891) | `LADDER`, `nextStep`, `increase` (one step, capped at `ceiling`) |
| Increase only when consistent; 10/12 or 9/12 is excellent (س 1246–1251) | adherence over the last 28 full days ≥ 0.75 |
| 4–5 active days a week, 2–3 at the start (س 990–992) | `activeDaysPerWeek` 2…7, `targetDaysIn` prorated |
| Same-day make-up, any amount counts «خربانة؟ صلّحها» (س 434–449, 1028–1060) | `logDone` adds up; any amount > 0 is a done day |
| Never double the next day (س 1129–1136) | `requiredOn` never reads the log |
| 50–70% is fine at the beginning (س 1246–1251) | `adherenceBand`: excellent ≥ 0.75, good ≥ 0.5 (≥ 0.4 in the first 60 days), else gentle. No failure band |
| Ebb of the heart: lighten, do not stop (س 1195–1219) | `startEbb`: `requiredOn` asks for 2 (or less) |
| Seasons: increase, then return without blame (س 948–966) | `startSeason`; `normalize` restores `previous` after `until`; the hold clock is untouched |
| After a relapse cut 50–80% (س 1442–1460) | `status` = 'relapse' after 7 empty days; `relapseSuggestion` = ladder value ≤ 40% |
| Obligations first; free time is 2–5 hours (س 1332–1376) | `loadWarning`: 'over' when nawafil minutes > 50% of free minutes |
| Leaving sins: harms, alternatives first, environment, limits (س 1463–1515) | stages `harms → alternatives → environment → limits → leave` |
| Owner decision (roadmap §4.1): gradual only for haqq_allah when very hard; haqq_ibad always cut + restore rights | `pathFor`, `stagesFor` (adds `restore_rights`), `validateProgram` rejects gradual haqq_ibad |

Sin-program stages: each lasts at least 7 days and advances when the 7 days before hold ≥ 4 check-ins of any
value; otherwise the user stays, with no penalty. `summary` gives counts only (no streaks). After «وقعت ثم تبت»
`afterFall` returns `'fixit'` (the app shows the «خربانة؟ صلّحها» content).

## Privacy

- **Sin-program data never leaves the device in clear** (roadmap §0.1, sync contract §1). The only thing that
  leaves is the vault ciphertext under the user's privacy code. Never put it in a sync body, logs, analytics,
  notification text or calendar titles. `exportForSync` and `localChanges` have no `programs`, and `parseStore`
  copies only known fields so nothing can ride along.
- Kinship names are nicknames only. `looksLikeContactDetails` rejects phone numbers (≥ 7 digits, Latin,
  Arabic-Indic or Persian), emails and links; `validateRelative` applies it to `name` and `relation`.
