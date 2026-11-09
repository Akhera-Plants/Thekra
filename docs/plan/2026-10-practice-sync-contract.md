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

**Phase 2 (2026-10-31, migration `20261031120000_phase2_practice`, additive):** `HabitPlan.pausedOn @db.Date?`,
`HabitPlan.resumedOn @db.Date?`, `HabitPlan.establishedOn @db.Date?`, `Relative.circle String @default("kin")`
(`kin | parents | neighbors | friends | sick`), `PracticeSettings.excusedDays String[] @default([])` (ascending, unique,
≤ 60). `resumedOn` is not in the redesign list: it keeps the paused days out of the streak after «استأنف» (a pause is
`[pausedOn, resumedOn)`); it is valid only with `pausedOn` and never before it.

**Phase 6 (2026-11-02, migration `20261102090000_reminder_sets_prayer_anchors`, additive):** `HabitPlan.slotAnchors
Json?`: one prayer anchor per slot (`after-fajr | after-dhuhr | after-asr | after-maghrib | after-isha | before-sleep`, or
`null` for a fixed time), same length as `slots`; `null` when the plan has no anchor. An anchored slot keeps the anchor's
default time in `slots` (practice-core `DEFAULT_ANCHOR_TIMES`), so a client that does not know anchors still has a time.
On the wire `slotAnchors` is in the canonical content only when at least one slot is anchored (older plans keep their
acked versions); a client that omits it sends none (last writer wins on the whole plan, as for the phase-2 fields).
Each client resolves anchors from its own 30-day AlAdhan cache (practice-core `prayer.ts`); the server never does.

**«حلقة العادة» (2026-11-01, migration `20261103090000_habit_loops`, additive):** `HabitPlan.loops Json?`: the habit
loops a member built for the habit (practice-core `HabitLoop[]`), `null` when none. Each loop is
`{ id, cue, craving, routine, reward, obstacle?, ifThen?, updatedAt }`:

| Field | Template question | Rule |
| --- | --- | --- |
| `id` | — | 1–64 characters of `A–Z a–z 0–9 _ -`, unique within the plan |
| `cue` | «الإشارة» (when / where) | string, ≤ 300 characters (may be empty while drafting) |
| `craving` | «الرغبة / النية» | string, ≤ 300 |
| `routine` | «الفعل» | string, ≤ 300, **not empty** |
| `reward` | «المكافأة» | string, ≤ 300 |
| `obstacle` | «ما الذي يعيقك؟» (optional) | string, ≤ 300; absent when not answered |
| `ifThen` | «خطة إن عاق» (optional) | string, ≤ 300; absent when not answered |
| `updatedAt` | — | ISO time of the loop's last edit, **stored exactly as sent** (no normalisation) |

At most 5 loops per plan (`MAX_HABIT_LOOPS`). Validation is practice-core `validateHabitLoops` (called from
`validatePlan`); unknown loop fields are dropped (`cloneHabitLoop`). Merge: the loops are part of the plan's canonical
content, so the plan's last-writer-wins applies to the whole list (no per-loop merge on the server; each loop's
`updatedAt` is for display). In the canonical content (`planFields`) `loops` comes after `slotAnchors` and only when
there is at least one loop, each loop in the fixed order above, so older plans keep their acked versions. Postgres
`jsonb` reorders object keys, so the server returns loops through `cloneHabitLoop` (canonical order). Compatibility:
a client that does not know loops omits them, and its newer edit of the plan clears them (as for `slotAnchors`);
the clients ship the field together.

**Round 5 (2026-11-07, migration `20261107120000_round5_home_sections_fard`, additive;
[owner round 5](2026-11-07-owner-round-5.md) F-02 a, F-05 a):**

| Change | Column / table | Rule |
| --- | --- | --- |
| «خصّص الرئيسية» | `PracticeSettings.homeSections Json?` | practice-core `HomeSectionPref[]` `[{ key, visible }]` in the member's order; keys from `HOME_SECTION_KEYS` (`wird, daily-text, week-branch, occasion, doors, moments, featured, sources`), 1–8 entries, unique (`validateHomeSections`). `null` = the defaults; a client never stores the defaults (it sends `null`). jsonb reorders object keys, so the server returns it in the canonical `{ key, visible }` order (`homeSectionsOf`) |
| «الفرائض» switch | `PracticeSettings.fardTracking Boolean @default(false)` | opt-in |
| «الفرائض» marks | `FardMark { userId→User (cascade), date @db.Date, prayer, status String?, clientUpdatedAt, updatedAt @updatedAt }`, `@@id([userId, date, prayer])`, `@@index([userId, updatedAt])` | `prayer` ∈ `fajr dhuhr asr maghrib isha`; `status` ∈ `onTime qada` or `null` (a cleared mark, kept so the clearing syncs); the date is never later than tomorrow (UTC) |

Both settings fields are part of the settings record (last writer wins on the whole record). In the canonical content
(`settingsContent`) `homeSections` comes after `excusedDays` and only when set, `fardTracking` last and only when
`true`, so every older settings record keeps its content and acked versions stay valid. An older client omits both:
its newer settings edit resets them to the defaults (as for `excusedDays`); the clients ship the fields together.
«الفرائض» marks are not habits: they never count toward the habit limits, the streak or the push reminders (a sync
that carries only marks does not re-plan pushes).

**Round 6 (2026-11-09, migration `20261109170000_round6_practice`, additive;
[owner round 6](2026-11-09-owner-round-6.md) §2–§8):**

| Change | Column / table | Rule |
| --- | --- | --- |
| «القدر الأدنى» | `HabitPlan.minimum Float?` | positive, not above the everyday amount (`validatePlan`); a hard day asks exactly it (`minimumOf`); `decreaseTo` never goes below it |
| Start amount | `HabitPlan.startAmount Float?` | set by `createPlan` (= the first amount); older plans: null |
| Restart after the archive | `HabitPlan.restartedOn @db.Date?` | set when a plan is restored after more than 3 days archived (`restorePlan` → `restartProgress`): amount back to the start, hold restarted, kept days / per-habit streak / milestones count from it. History logs are kept |
| «الأرشيف» = pause | `HabitPlan.pausedOn` / `resumedOn` (unchanged) | an archived plan is a paused one (old data reads as archived). At most **10** archived live plans: a request that takes the count above 10 → 422 `PRACTICE_LIMIT_REACHED` (`details.archived = 10`); an account already above 10 may keep them but not add more |
| «حال يومي» | `PracticeSettings.dayStates Json?` | practice-core `DayStateEntry[]` `[{ date, state }]`, `state` ∈ `sick busy travel`, ascending, unique, ≤ 60 (`validateDayStates`); null = none. `sick` / `travel` days are also in `excusedDays` (older clients skip them); `busy` on today also starts the plans' one-day `ebb` (older clients ask the minimum). Old data: an excused day without a state reads as `sick` (`legacy`), a plan ebb as `busy` (`legacy`) |
| «قضاء الفوائت» plan | `PracticeSettings.qada Json?` | practice-core `QadaPlan` `{ owed: { fajr, dhuhr, asr, maghrib, isha, any }, perDay, startedOn }` (each owed 0…10000, at least one > 0; `perDay` 1…50; `validateQadaPlan`); null = none. jsonb reorders keys: the server returns it through `parseQadaPlan` (canonical order) |
| «قضاء الفوائت» make-ups | `QadaLog { userId→User (cascade), date @db.Date, prayer, count Int, clientUpdatedAt, updatedAt }`, `@@id([userId, date, prayer])` | `prayer` ∈ `fajr dhuhr asr maghrib isha any`; `count` 0…100 (0 = a cleared day, kept so it syncs); the date is never later than tomorrow (UTC) |
| «تخفّف» covering | `PracticeSettings.lightenCovered Boolean @default(true)` | the «تخفّف» rows in «العادات» are covered by default; `false` = the member turned it off. The programs themselves stay in the vault |
| Reciter | `PracticeSettings.reciter String?` | a practice-core `RECITERS` key; null = the default (`alafasy`) |
| Habit reflections | `HabitReflection { planId→HabitPlan (cascade), date @db.Date, helped?, hard?, note?, clientUpdatedAt, updatedAt }`, `@@id([planId, date])` | «ما الذي أعانك؟» / «ما الذي صعّب عليك؟» / day note, each ≤ 300 characters, stored as sent; all null = a cleared reflection (kept so it syncs); date ≤ tomorrow (UTC); the plan must be the user's or in the same request (else 404, like logs). Sin-program answers never come here: they are `CheckIn.helped` / `CheckIn.hard` inside the vault |
| Read marks | `QuoteRead { userId→User (cascade), quoteId, read Boolean, clientUpdatedAt, updatedAt }`, `@@id([userId, quoteId])` | `quoteId` a UUID (stored lower-case; no foreign key, so a text leaving the public set never fails a sync); the server keeps the newest 3000 per user by `clientUpdatedAt` (`READS_MAX`), the clients the same |

Merge rules: the plan fields and the settings fields are part of their record (last writer wins). In the canonical content
`minimum`, `startAmount`, `restartedOn` come after `loops`, each only when set; `settingsContent` adds `dayStates` (not
empty), `qada`, `lightenCovered` (only when `false`), `reciter` after `fardTracking`, each only when set — so every older
record keeps its content and acked versions stay valid. An older client omits them: its newer edit resets them to the
defaults (as before). The three lists are last writer wins per key by `clientUpdatedAt`; ties: reflection → the larger
canonical content (`compareReflections`), `qadaLog` → the larger count (`compareQadaLogs`), read → unread
(`compareReadMarks`). Reflections, «قضاء» counts and read marks never change a reminder, so a sync that carries only
them does not re-plan pushes. Export (`GET /v1/auth/me/export`) includes all three lists; `DELETE /v1/auth/me` cascades them.

Device-local in round 6 (never synced): «رسائلي إلى نفسي» (`HeartData.messages`, at most 10: private words, like the rest
of HeartData), the notification switches (the web sends its own with its push subscription, now with `strategies`,
`strategyDay`, `strategyTime`, `intentionReminder`, `intentionTime`, `mutedPlans`, `mutedActs`). «الأعمال الدورية» needs
no new data: a periodic act is a plan (catalog template or `habitKey = custom-periodic`) or, for «صلة الرحم والأحباب»,
the existing `Relative` rows of every circle (no row moved or renamed: the round-5 people are now the people of this act).

## 3. Sync API (all JWT, `private, no-store`, throttled like other user routes)

### `GET /v1/me/practice?since=<ISO>` → changes after `since` (everything when absent)

```json
{ "data": {
  "serverTime": "2026-10-28T18:00:00.000Z",
  "settings": { "hijriOffset": 0, "reminderTimes": ["07:00"], "freeMinutesPerDay": 60, "excusedDays": [],
                "clientUpdatedAt": "…", "updatedAt": "…" } | null,
  "plans": [ { "id": "…", "habitKey": "duha", "deedSlug": "nawafil", "title": "…", "unit": "times", "amount": 1,
               "ceiling": null, "activeDaysPerWeek": 3, "slots": ["09:30","11:00"], "rule": {…}|null,
               "createdOn": "2026-10-28", "amountChangedOn": "2026-10-28", "ebbSince": null, "season": null,
               "pausedOn": null, "resumedOn": null, "establishedOn": null, "slotAnchors": null, "loops": [ {…} ]|null,
               "clientUpdatedAt": "…", "deletedAt": null } ],
  "logs": [ { "planId": "…", "date": "2026-10-28", "amount": 1 }, { "planId": "…", "date": "2026-10-27", "amount": 0, "correctedAt": "<ISO>" } ],
  "relatives": [ { "id": "…", "name": "…", "relation": "…", "rule": {…}, "circle": "kin", "lastContactedOn": null,
                   "clientUpdatedAt": "…", "deletedAt": null } ],
  "contacts": [ { "relativeId": "…", "date": "2026-10-20", "deleted": false } ],
  "fard": [ { "date": "2026-10-28", "prayer": "fajr", "status": "onTime" | "qada" | null, "clientUpdatedAt": "…" } ]
} }
```

Round 5: `settings` also carries `"homeSections": [ { "key": "sources", "visible": true }, … ] | null` and
`"fardTracking": false`.

Round 6: `settings` also carries `"dayStates": [ { "date": "2026-11-09", "state": "travel" } ] | null`,
`"qada": { "owed": { "fajr": 3, "dhuhr": 0, "asr": 0, "maghrib": 0, "isha": 0, "any": 10 }, "perDay": 2, "startedOn": "2026-11-01" } | null`,
`"lightenCovered": true` and `"reciter": "husary" | null`; plans carry `"minimum"`, `"startAmount"`, `"restartedOn"` (null
when not set); and three lists:

```json
"reflections": [ { "planId": "…", "date": "2026-11-08", "helped": "…" | null, "hard": null, "note": null, "clientUpdatedAt": "…" } ],
"qadaLogs": [ { "date": "2026-11-08", "prayer": "fajr", "count": 2, "clientUpdatedAt": "…" } ],
"reads": [ { "quoteId": "5671bf91-…", "read": true, "clientUpdatedAt": "…" } ]
```

### `POST /v1/me/practice/sync` → apply local changes, return everything changed since `since`

Body: `{ "since": "<ISO>|null", "changes": { "settings"?: {…, "clientUpdatedAt"}, "plans": [...], "logs": [...],
"relatives": [...], "contacts": [...], "fard"?: [...], "reflections"?: [...], "qadaLogs"?: [...], "reads"?: [...] } }`
with at most 500 items in total (fard marks and the round-6 lists count). Response: same shape as GET, computed
after applying, with `since` = the request's `since`.

Merge rules (server and practice-core apply the same ones):

| Kind | Rule |
| --- | --- |
| plan, relative, settings | last writer wins by `clientUpdatedAt`; a tombstone (`deletedAt`) also carries `clientUpdatedAt` and wins only when newer |
| log (plan, date) | the later `correctedAt` wins (absent/null counts as the oldest); at the same `correctedAt` the larger amount wins. So plain logging never goes down (same-day partial amounts add up on the device first), and an undo of «تمّ» or a fixed amount (practice-core `correctLog`, which sets `correctedAt`; `amount` may then be 0) is not undone by a device that still holds the old amount. Added 2026-10-29 (`HabitLog.correctedAt`); a client that never sends `correctedAt` keeps the old max rule |
| contact (relative, date) | union; `deleted: true` sets a tombstone; a later non-deleted write clears it |
| fard (date, prayer) | last writer wins by `clientUpdatedAt`; at equal times a cleared mark (`status: null`) wins, then the larger status (practice-core `compareFardMarks`). Round 5 |
| reflection (plan, date) · qadaLog (date, prayer) · read (quote) | last writer wins by `clientUpdatedAt`; ties: the larger canonical content · the larger count · unread. Round 6 |

Phase-2 compatibility: a client that omits `pausedOn` / `resumedOn` / `establishedOn` sends null, `circle` → `kin`,
`excusedDays` → `[]`. The canonical content (`planFields`, `relativeFields`, `settingsContent`) carries the new values
only when set (`circle` only when not `kin`, `excusedDays` only when not empty), so every older record keeps the
content it had and acked versions stay valid. Last writer wins on the whole record: an older client that edits a paused
plan later than the pause clears it (expected; the pause can be set again).

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
- **Phase 3 (2026-10-31, «تخفَّف»), inside the plaintext only:** a check-in may carry `triggers` (`when` / `where` /
  `feeling`, chip keys from practice-core `TRIGGER_TIMES` / `TRIGGER_PLACES` / `TRIGGER_FEELINGS`, only on `weak` or
  `fell_repented`), `goodDeed: true` («حسنة الآن») and `nextLimit` (a `GENERIC_LIMITS` key or `action:<n>`). They travel
  only inside the encrypted vault with the check-in and merge with it by date. Stored programs without them read as
  none; an unknown or invalid part is dropped (`sanitizeCheckIn`), never the day. «متى تضعف؟», the counters and the
  weekly task are derived on the device and stored nowhere. The server is unchanged (it never sees the plaintext).
- **«حلقة المعصية» (2026-11-01), inside the plaintext only:** a program may carry `loops`, practice-core `SinLoop[]`:
  `{ id, trigger (المثير/الموقف), feeling (الشعور), craving (الرغبة), act (الفعل), after (ما يحصل بعده), alternative
  (البديل), updatedAt, removedAt? }`, each answer ≤ 300 characters, at least one answer not empty, at most 5 live loops
  and 20 entries with removal markers. A removed loop keeps only `id`, empty answers, `updatedAt` and `removedAt`, so a
  merge does not bring it back. `mergePrograms` unites loops by id, the later `updatedAt` wins (a tie keeps this
  device's). Ending a program drops its loops with its notes. A damaged loop is dropped on read, never the program.
  The server is unchanged.
- **Always on (owner, 2026-11-01):** «تخفَّف» data is always kept in the account as this vault; there is no
  device-only mode. Client steps: [2026-11-01-sin-vault-always-on.md](2026-11-01-sin-vault-always-on.md).

After a sync the web push planner follows practice-core: a paused plan reminds of nothing (and no day inside a pause),
an established plan in its first slot only (`reminderSlots`); a visited sick person is no longer due, an unvisited one
repeats every 2 days.

Export (`GET /v1/auth/me/export`) includes settings, plans, logs, relatives, contacts, «الفرائض» marks and the vault **ciphertext**
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
- The unlocked key is kept in memory for the session. On the app it is also kept in the device keystore behind
  biometrics (`serializeVaultKey` / `parseVaultKey`, `expo-secure-store`); on the web it lives for the session only
  (IndexedDB non-extractable `CryptoKey` is not available for noble). `createVault(code, programs)` makes the first
  vault; `sealVault(programs, kept, version)` re-seals with the kept key and salt (autosave). See
  [2026-11-01-sin-vault-always-on.md](2026-11-01-sin-vault-always-on.md).

## 5. Clients

| Client | Sign-in | Synced | Sin program |
| --- | --- | --- | --- |
| Web | existing JWT auth, turned on (`NEXT_PUBLIC_ACCOUNTS_ENABLED=true` on Vercel) | settings, plans, logs, relatives, contacts | encrypted vault, unlocked with the privacy code |
| Mobile | existing login | same | same, with optional keystore remember |
| Extension | email + password in the popup (token in `chrome.storage.local`) | plans and logs only | not in the extension |

Sync runs on sign-in, on app focus, after a local edit (debounced 3 s) and every 15 minutes while open.

**Phase 4 (2026-11-01, «المقامات الستة»):** «نية اليوم», the evening and Friday reviews, «رسالة إلى نفسي» and
«التزام شخصي» are practice-core `HeartData`, kept by each client on the device (web `thekra.practice.heart.v1`, app
AsyncStorage `thekra.practice.heart.v1`) and never synced or sent. The sync contract is unchanged; only a step chosen in a
Friday review edits a plan's amount (the usual `increase` / `decreaseTo`, synced like any plan edit). Round 5: the
deed chosen in «صلّحها» after two missed days (`HeartData.makeUps`) is device-local too. The notification
switches are device-local too; the web sends its own with the push subscription (docs/plan/2026-10-web-push.md).
