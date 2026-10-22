# Thekra — Silat ar-Rahim Reminders & Forgotten Good Deeds (Phase 4b)

> Scope: a new, **account-only** feature placed as **Phase 4b** in the [roadmap](./roadmap.md#phase-4b--silat-ar-rahim--forgotten-deeds),
> right after Phase 4 (auth) which it depends on. **Documentation only** — nothing in `backend/`, `frontend/` or
> `mobile/` was created or changed, nothing was installed, no migration was generated.
> Every model, field, enum, endpoint, module, route and dependency below is a **proposed addition requiring owner
> approval** before Cursor implements it ([backend/.cursorrules](../../backend/.cursorrules) → "Schema Changes Are
> Exceptional"; "Dependencies").
> Cross-doc: [TECHNICAL_PLAN.md](../TECHNICAL_PLAN.md) · [backend-plan.md](./backend-plan.md) ·
> [frontend-plan.md](./frontend-plan.md) · [mobile-plan.md](./mobile-plan.md) · [devops-plan.md](./devops-plan.md) ·
> [roadmap.md](./roadmap.md)
>
> **Amended by [vision-v2-plan.md §10](./vision-v2-plan.md#10-reminders-for-any-good-deed--phase-4b-amendment):**
> open decision S3 is resolved — a deed reminder can target **any** `GoodDeed` (الصدقة and the acts of worship the
> owner adds), not only forgotten deeds. Forgotten deeds keep the spotlight and the catalogue filter. No schema
> change; only the eligibility check in #72 is dropped.

**The feature in one paragraph.** A signed-in user keeps a private list of relatives (رحم) they want to stay in
touch with, each with a contact rhythm ("every week", "every month"…). The app shows who is **due this week or
overdue**, lets the user tap **"تواصلت معه"** to restart that relative's cycle, and pairs the list with a motivating
verse/hadith about صلة الرحم drawn from the **existing** good-deed content. Reminders reach the phone **without a
push server**: the backend serves a private **calendar subscription feed** (`webcal://`, RFC 5545 with `RRULE`)
and the phone's own calendar does the scheduling and alerting. Alongside it, **forgotten good deeds** — good deeds
people commonly neglect — are surfaced to everyone (guest-first) as a deterministic "forgotten deed of the week",
and a signed-in user can opt individual forgotten deeds into the same reminder schedule.

---

## 0. Ground rules inherited from the plan set

| Rule | Source | Consequence here |
| --- | --- | --- |
| **Guest-first** | [TECHNICAL_PLAN B1](../TECHNICAL_PLAN.md#b-auth--access) | Only the *personal list and its reminders* need an account. Browsing forgotten deeds, the deed-of-the-week, and every core flow stay anonymous. `/kinship` shows a sign-in prompt, never a redirect. |
| **Privacy of intent** | [TECHNICAL_PLAN §I.7](../TECHNICAL_PLAN.md#i-standing-assumptions) | **Unchanged and not weakened.** The kinship module never reads, writes or joins anything about sins or sin selections. Kinship data is a separate concern with its own, stricter rules (§8). |
| **Schema is final; changes are exceptional** | [backend/.cursorrules](../../backend/.cursorrules), [backend-plan §9](./backend-plan.md#9-proposed-schema-additions) | §4 is a *proposal*. It ships as its own migration in its own commit (`prisma migrate dev --name add_kinship_reminders`) only after approval. |
| **Approved module list is exactly backend-plan §1** | [backend-plan §1](./backend-plan.md#1-module-map) | This plan adds exactly **one** module, `modules/kinship/`, to that list ([§1.13](./backend-plan.md#113-moduleskinship--phase-4b-proposed)). Forgotten deeds add **no** module. |
| **API conventions are fixed** | [backend-plan §2](./backend-plan.md#2-global-api-conventions) | `/v1` prefix, `{ data, meta }` envelope, the standard error shape and status-code policy — the only exception is the ICS feed, which returns `text/calendar` (§7.6). |
| **Cache, don't proxy / content integrity** | [TECHNICAL_PLAN §I.4, §I.6](../TECHNICAL_PLAN.md#i-standing-assumptions) | The motivating quote comes through the existing endpoint #7, so the grade policy (`MAWDU` never, `DAIF` opt-in) gates it automatically. |
| **No scheduler for this feature** | Owner decision 4 | Nothing has to happen on the server at "due time". `nextDueOn` is computed **on write**; "due" is a comparison against today at **read** time; alerts come from the calendar app (and on-device notifications in Phase 7). No cron, no queue, no push service. |

---

## 1. Goal and user stories

**Goal:** help a person keep the ties of kinship they *intend* to keep, with the least possible friction and the
least possible data, and remind them of good deeds that are easy to forget.

| # | As a… | I want… (Arabic-first example) | So that… | Needs account |
| --- | --- | --- | --- | --- |
| U1 | user | «أريد أن أتذكّر الاتصال بخالتي كل أسبوع، يوم الجمعة.» — add a relative with a weekly rhythm and a preferred day | I'm reminded on the day I'd actually call | yes |
| U2 | user | «زرتُ جدّي اليوم — سجّل ذلك وذكّرني بعد شهر.» — tap "تواصلت معه", optionally pick how (call / visit / message / gift) | the cycle restarts from today | yes |
| U3 | user | «من حان وقت صلته هذا الأسبوع؟» — one list: overdue first, then due this week | I see at a glance whom I've been neglecting | yes |
| U4 | user | «أريد التذكيرات في تقويم هاتفي، دون أن تظهر أسماء أقاربي.» — subscribe once from my phone's calendar; titles generic by default | I get native reminders with no app installed and nothing personal on my lock screen or at Google/Apple | yes |
| U5 | user | «تراجعت — لم أتصل بها فعلاً.» — undo a contact I logged by mistake | the due date goes back to what it was | yes |
| U6 | anyone | «ما العمل الصالح المنسيّ لهذا الأسبوع؟» — see the forgotten deed of the week on the home screen | I rediscover a deed I'd neglected — no sign-in needed | **no** |
| U7 | user | «أضِف "عيادة المريض" إلى تذكيراتي كل أسبوعين.» — opt a forgotten deed into my schedule | it appears in the same due list and calendar feed | yes |
| U8 | user | «صدّر بياناتي» / «احذف حسابي وكل بياناتي» | I control the personal data I've stored about my family | yes |
| U9 | user | «أوقف رابط التقويم، أظن أنني شاركته بالخطأ.» — revoke/rotate the feed link | the old link stops working immediately | yes |

---

## 2. Islamic content angle — reuse, don't duplicate

**The kinship screen pairs "who is due" with one motivating text about صلة الرحم, served by the existing
good-deed flow.** No new content table, no new quote endpoint, no copy of quote text into the kinship module.

| Item | Decision |
| --- | --- |
| Source of the motivating text | The existing `GoodDeed` with slug **`silat-ar-rahim`** (present in the dev seed, `oppositeSin = qat-al-rahim`) and its curated `GoodDeedQuote` links. The client calls existing endpoint **#7**: `GET /v1/good-deeds/silat-ar-rahim/quotes?limit=1&shuffle=true&seed=<yyyy-mm-dd>` — the daily seed rotates the text within the high-relevance band ([backend-plan §4.2](./backend-plan.md#42-shuffle--variety-mode)) without any IP or user input. |
| Rendering | The shared `QuoteCard` from `components/shared/quote/` (full provenance, `GradeBadge`), exactly as on `/good-deeds/[slug]`. Never a kinship-specific quote card. |
| What exists today | The dev seed already contains a صلة الرحم narration referenced as **Bukhari 5986**, linked to `silat-ar-rahim` (and to `qat-al-rahim`). The [phase-2 backend review](../reviews/phase-2-backend-review.md) flagged its seeded grade for correction — **verification is the owner's**, as for all content. |
| Due deed reminders | A due forgotten-deed reminder links to `/good-deeds/[slug]` for that deed — again the existing flow. |
| Tone | Motivating, not shaming: the kinship screen never surfaces the `qat-al-rahim` sin content, even though the deed's `oppositeSin` points to it. |
| Forgotten deeds content | **To be curated and verified by the owner.** Candidate *topics* from the brief — visiting the sick, du'a for parents after their death, smiling, removing harm from the road — become `GoodDeed` rows and `LOCAL` quotes through the existing admin endpoints (#39, #28, #53, #35). This plan cites **no** text, reference or grade for them. |

---

## 3. Reminder delivery — least-cost order

### 3.1 Chosen channels

| Order | Channel | Phase | Cost | How it works |
| --- | --- | --- | --- | --- |
| a | **In-app due list** ("overdue" / "due this week") | 4b | free | `GET /v1/kinship/due` compares `nextDueOn` with the client's local date. Visible whenever the user opens `/kinship`. |
| b | **Personal calendar subscription feed** (`webcal://` → ICS, RFC 5545, `RRULE`) | 4b | free — no push server, no cron, no third party | The backend renders the user's schedule as an ICS document at an unguessable per-user URL. The user subscribes once (Apple Calendar, Google Calendar, Outlook…). The **phone's calendar** expands the recurrence and fires the alerts. Editing the list or tapping "تواصلت معه" changes the feed; the calendar picks it up on its next poll. The token is revocable and rotatable (§5.5). |
| c | **On-device local notifications** (`expo-notifications`) | 7 | free | The mobile app schedules notifications locally from the same kinship data — see [mobile-plan §3.2](./mobile-plan.md#32-phase-4b-reminders--on-device-local-notifications). Not designed here. |

Known limitation of (b), stated honestly in the UI: calendar apps poll subscribed feeds on **their** schedule
(often every few hours; Google Calendar can take up to a day or more), so a "contacted" tap may take that long to
remove the next reminder from the calendar. The in-app list is always exact. The feed advertises
`REFRESH-INTERVAL`/`X-PUBLISHED-TTL` hints (§7.6), which some clients honour.

### 3.2 Rejected for now

| Channel | Why not (one line) |
| --- | --- |
| **Web push** | Needs a server-side scheduler, stored push subscriptions/VAPID keys and delivery bookkeeping, and iOS only delivers web push to an installed home-screen PWA — high cost for patchy reach. |
| **Email reminders** | Needs an email provider, a scheduler and deliverability work (SPF/DKIM, bounces, unsubscribe) — recurring cost and operational burden for a free, low-traffic app. |

Content push ("a verse a day") stays **out of scope** in every phase ([TECHNICAL_PLAN F5](../TECHNICAL_PLAN.md#f-mobile)).

---

## 4. Data model — proposed schema additions

> **PROPOSED — Phase 4b. Requires explicit owner approval.** Additive only: no existing column is dropped,
> renamed or repurposed. Applies on top of the Phase 4 auth additions ([backend-plan §9](./backend-plan.md#9-proposed-schema-additions)).
> Ships as its own commit: `prisma migrate dev --name add_kinship_reminders`.

### 4.1 Schema block

```prisma
// PROPOSED — Phase 4b (Silat ar-Rahim & forgotten deeds). Additive only.
// Requires owner approval (backend/.cursorrules "Schema Changes Are Exceptional").

enum KinRelation {
  PARENT
  CHILD
  SIBLING
  GRANDPARENT
  GRANDCHILD
  PATERNAL_UNCLE_AUNT // عمّ / عمّة
  MATERNAL_UNCLE_AUNT // خال / خالة
  COUSIN
  NIECE_NEPHEW
  OTHER
}

enum ReminderFrequency {
  WEEKLY
  BIWEEKLY
  MONTHLY
  CUSTOM // uses intervalDays
}

/// RFC 5545 BYDAY tokens, so the value maps 1:1 onto RRULE.
enum Weekday {
  MO
  TU
  WE
  TH
  FR
  SA
  SU
}

enum ContactMethod {
  CALL
  VISIT
  MESSAGE
  GIFT
  OTHER
}

model Relative {
  id               String            @id @default(uuid())
  userId           String
  user             User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  name             String            /// display name or nickname only — max 60 chars; never phone/email/address
  relation         KinRelation
  frequency        ReminderFrequency
  intervalDays     Int?              /// required iff frequency = CUSTOM (1–365); null otherwise
  preferredWeekday Weekday?          /// only for WEEKLY / BIWEEKLY
  lastContactedOn  DateTime?         @db.Date /// denormalised max(ContactLog.contactedOn)
  nextDueOn        DateTime          @db.Date /// computed on every write (§4.3) — never by a scheduler
  isActive         Boolean           @default(true)
  note             String?           /// optional private note — max 280 chars
  contacts         ContactLog[]
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  @@index([userId, isActive, nextDueOn])
}

model ContactLog {
  id          String        @id @default(uuid())
  relativeId  String
  relative    Relative      @relation(fields: [relativeId], references: [id], onDelete: Cascade)
  contactedOn DateTime      @db.Date
  method      ContactMethod
  note        String?       /// optional — max 280 chars
  createdAt   DateTime      @default(now())

  @@index([relativeId, contactedOn(sort: Desc)])
}

model DeedReminder {
  id               String            @id @default(uuid())
  userId           String
  user             User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  goodDeedId       String
  goodDeed         GoodDeed          @relation(fields: [goodDeedId], references: [id], onDelete: Cascade)
  frequency        ReminderFrequency
  intervalDays     Int?
  preferredWeekday Weekday?
  lastDoneOn       DateTime?         @db.Date
  nextDueOn        DateTime          @db.Date
  isActive         Boolean           @default(true)
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  @@unique([userId, goodDeedId])
  @@index([userId, isActive, nextDueOn])
}

// Changes to EXISTING models (additive):
model User {
  // …existing fields + the Phase 4 additions (passwordHash, role, lastLoginAt)…
  calendarFeedTokenHash String?        @unique        // SHA-256 hex of the feed token; null = no active feed
  calendarShowNames     Boolean        @default(false) // false = generic event titles (§7.4)
  relatives             Relative[]                     // relation field only, no column
  deedReminders         DeedReminder[]                 // relation field only, no column
}

model GoodDeed {
  // …existing fields…
  deedReminders DeedReminder[] // relation field only, no column
}
```

### 4.2 Why each field exists

| Model.field | Why | Why not more |
| --- | --- | --- |
| `Relative.userId` (+ cascade) | Ownership; account deletion must remove every row about the user's family. | — |
| `Relative.name` | The user needs to know whom to call. A nickname («خالتي») is enough and is encouraged in the UI copy. | **No phone, email or address** — the phone already has them; storing them would make Thekra a copy of the user's address book. Enforced by a validator (§5.9). |
| `Relative.relation` | Arabic labels, grouping, and a generic description in the feed without naming anyone. Gender-neutral values on purpose (minimum data). | Exact kinship degree is not needed for a reminder. Whether in-laws belong is open ([§14](#14-open-decisions) S2). |
| `Relative.frequency` + `intervalDays` | The rhythm. Three fixed values cover most cases and map directly onto `RRULE`; `CUSTOM` + `intervalDays` covers the rest. | — |
| `Relative.preferredWeekday` | "Every Friday" is how people actually plan visits. Stored as the RFC 5545 token, so it becomes `BYDAY` with no mapping. | Not for `MONTHLY`/`CUSTOM`, where a weekday would conflict with the interval. |
| `Relative.lastContactedOn` | Shown as «آخر تواصل: منذ ٩ أيام». It is the anchor for `nextDueOn`. Denormalised from `ContactLog` so the due query never scans logs. | — |
| `Relative.nextDueOn` | The one column the due list and the feed read. Indexed with `userId`/`isActive`. | Computed on write, so no scheduler (§4.3). |
| `Relative.isActive` | Pause someone (travel, illness, a strained period) without deleting their history. | — |
| `Relative.note` | Short private context («تحب أن نسأل عن حفيدها»). Optional. | 280-char cap; **never** sent to the calendar feed in any mode. |
| `ContactLog` | Restarts the cycle, lets "undo" restore the previous date, and gives the user a private history. `method` is a low-detail enum, not free text. | No time-of-day, no duration, no location. Retention is open ([§14](#14-open-decisions) S10). |
| `DeedReminder` | Opting a forgotten deed into the same schedule. `@@unique([userId, goodDeedId])` keeps one reminder per deed. | No completion log — "done" only advances `lastDoneOn`/`nextDueOn`. Nothing records *which* deeds a user did and when, beyond the last date. |
| `User.calendarFeedTokenHash` | Authenticates the feed without a login (calendar apps cannot log in). Only a hash is stored, `@unique` for an indexed lookup. | — |
| `User.calendarShowNames` | Per-user opt-in to put names in event titles. Defaults to `false` (§8). | — |

**Dates, not instants.** Due dates and contact dates use `@db.Date` (a calendar day with no time) because a
reminder is "on Friday", not "at 21:00 UTC Thursday". This removes every timezone-drift bug from the server
(§7.5). The brief's suggested names `lastContactedAt`/`nextDueAt` are therefore spelled `lastContactedOn`/`nextDueOn`.
The naming is open ([§14](#14-open-decisions) S8).

### 4.3 How `nextDueOn` is computed — on write, by a pure function

`modules/kinship/schedule.ts` exports one pure function that is shared by relatives and deed reminders:

```ts
// shape only
step(frequency, intervalDays, from):           // the interval
  WEEKLY   → from + 7 days
  BIWEEKLY → from + 14 days
  MONTHLY  → same day-of-month next month, day capped at 28   // see the RRULE note in §7.3
  CUSTOM   → from + intervalDays days

snap(date, preferredWeekday?):                 // forward only, 0–6 days
  preferredWeekday ? first date ≥ date whose weekday = preferredWeekday : date

computeNextDueOn({ frequency, intervalDays, preferredWeekday, lastContactedOn }, today):
  lastContactedOn == null ? snap(today, preferredWeekday)                       // new relative: due now
                          : snap(step(frequency, intervalDays, lastContactedOn), preferredWeekday)
```

It is called **inside the same transaction** as every write that can change the inputs:

| Write | Effect |
| --- | --- |
| Create a relative | If the body has `lastContactedOn` («آخر مرة اتصلت بها: قبل أسبوعين»), a `ContactLog` with `method = OTHER` is created for that date. Then compute. |
| `POST …/contacts` | Insert the log. `lastContactedOn = max(existing, contactedOn)` (a backdated log never moves it backwards). Recompute. |
| `DELETE …/contacts/:id` (undo) | Delete the log. `lastContactedOn = max(remaining logs) ?? null`. Recompute. |
| `PATCH` of `frequency` / `intervalDays` / `preferredWeekday`, or reactivation | Recompute from the current `lastContactedOn`. |
| Deed reminder `…/done` | `lastDoneOn = date`. Recompute with `lastDoneOn` as the anchor. |

**Today** is the client's local date, passed as `today=YYYY-MM-DD` (it is the only party that knows the user's
calendar day). The server accepts it only within ±1 day of its own UTC date and otherwise uses its UTC date, so a
buggy client cannot plant far-future dates. No timezone is stored.

**Why no scheduler:** nothing happens at due time on the server. "Overdue" is `nextDueOn < today` evaluated at
read time, and the alert is the calendar's job. A cron job would add infrastructure to compute a value that is
already correct the moment it is written.

### 4.4 Forgotten deeds need no schema change

**Repo fact that shapes this:** in the current schema a `Tag` attaches **only to `Quote`** (through `QuoteTag`).
There is no `GoodDeed ↔ Tag` relation. The owner's decision ("a `Tag` with `category = THEME` on `GoodDeed`s / their
quotes") is therefore implemented through the **quotes**:

| Piece | Implementation (no schema change) |
| --- | --- |
| The tag | One `Tag` row: `slug = forgotten-deeds`, `category = THEME`, `nameAr = الأعمال المنسية` (Arabic label to be confirmed by the owner). Created through admin endpoint #45. |
| Membership | A `GoodDeed` is a **forgotten deed** iff it has ≥1 `GoodDeedQuote` link whose quote carries the `forgotten-deeds` tag **and** passes the default grade policy (a `MAWDU`/`DAIF`/`UNGRADED`-only link does not qualify). Curators tag the quote that speaks to the deed being neglected (admin #35). |
| Caveat | A tagged quote that is linked to several deeds makes all of them "forgotten". Curators should tag only quotes linked to the one deed they mean. If this gets awkward, the clean fix is a schema addition (`GoodDeedTag` join or `GoodDeed.isForgotten`). That is open decision [S1](#14-open-decisions), **not** proposed now. |
| Not used | `GoodDeed.category` (free string, already used for real categories such as `family`/`worship`). Overloading it would destroy that grouping. |

---

## 5. REST API

All paths are relative to `/v1` ([backend-plan §2.1](./backend-plan.md#21-versioning)). Auth column as in
[backend-plan §3](./backend-plan.md#3-rest-api-spec): `public`, `user`, plus **`token`** = authenticated only by
the feed token in the path. Every JSON response uses the `{ data, meta }` envelope and the standard error shape.
Endpoint numbers continue the backend-plan index.

### 5.0 Endpoint index (Phase 4b)

| # | Method | Path | Auth |
| --- | --- | --- | --- |
| 5′ | GET | `/good-deeds?tag=forgotten-deeds` — **additive** `tag` filter on existing #5 | public |
| 62 | GET | `/kinship/relatives` | user |
| 63 | POST | `/kinship/relatives` | user |
| 64 | GET | `/kinship/relatives/:id` | user |
| 65 | PATCH | `/kinship/relatives/:id` | user |
| 66 | DELETE | `/kinship/relatives/:id` | user |
| 67 | POST | `/kinship/relatives/:id/contacts` | user |
| 68 | GET | `/kinship/relatives/:id/contacts` | user |
| 69 | DELETE | `/kinship/relatives/:id/contacts/:contactId` | user |
| 70 | GET | `/kinship/due` | user |
| 71 | GET | `/kinship/deed-reminders` | user |
| 72 | POST | `/kinship/deed-reminders` | user |
| 73 | PATCH | `/kinship/deed-reminders/:id` | user |
| 74 | DELETE | `/kinship/deed-reminders/:id` | user |
| 75 | POST | `/kinship/deed-reminders/:id/done` | user |
| 76 | GET | `/kinship/calendar` | user |
| 77 | PATCH | `/kinship/calendar` | user |
| 78 | POST | `/kinship/calendar/token` | user |
| 79 | DELETE | `/kinship/calendar/token` | user |
| 80 | GET | `/kinship/calendar/feeds/:token.ics` → **`text/calendar`** | token |
| 81 | GET | `/good-deeds/spotlight` | public |
| 82 | GET | `/auth/me/export` | user |
| 83 | DELETE | `/auth/me` | user |

**Ownership rule for every `user` route:** a row that belongs to another user returns **`404 RESOURCE_NOT_FOUND`**,
never `403`, so an id cannot be used to probe whether someone else's row exists. Services always filter
`where: { id, userId }`.

### 5.1 Shared response shapes

```jsonc
// RelativeDto
{ "id": "…", "name": "خالتي", "relation": "MATERNAL_UNCLE_AUNT",
  "frequency": "WEEKLY", "intervalDays": null, "preferredWeekday": "FR",
  "lastContactedOn": "2025-01-10", "nextDueOn": "2025-01-17",
  "dueStatus": "DUE_SOON",        // OVERDUE | DUE_TODAY | DUE_SOON | UPCOMING — derived from `today`, not stored
  "daysUntilDue": 3,              // negative when overdue
  "isActive": true, "note": "…", "createdAt": "…", "updatedAt": "…" }

// ContactLogDto
{ "id": "…", "contactedOn": "2025-01-10", "method": "CALL", "note": null, "createdAt": "…" }

// DeedReminderDto — the deed is a public summary from GoodDeedsService
{ "id": "…", "goodDeed": { "id": "…", "slug": "…", "name": "…", "nameAr": "…" },
  "frequency": "BIWEEKLY", "intervalDays": null, "preferredWeekday": null,
  "lastDoneOn": null, "nextDueOn": "2025-01-14", "dueStatus": "OVERDUE", "daysUntilDue": -3,
  "isActive": true, "createdAt": "…", "updatedAt": "…" }
```

`DUE_SOON` = due within the `horizonDays` window (default 7). Dates are serialised as `YYYY-MM-DD` strings, never
as ISO instants, matching `@db.Date`.

### 5.2 Relatives (62–66)

| # | Endpoint | Request | Response | Codes |
| --- | --- | --- | --- | --- |
| 62 | `GET /kinship/relatives` | `page`, `limit` (max 100), `isActive?`, `today?`, `sort?` = `nextDue\|name` (default `nextDue`) | `{ data: RelativeDto[], meta: PageMeta }` | `200`, `400`, `401` |
| 63 | `POST /kinship/relatives` | `CreateRelativeDto`: `name`, `relation`, `frequency`, `intervalDays?`, `preferredWeekday?`, `note?`, `lastContactedOn?` (`YYYY-MM-DD`, not in the future), `today?` | `201 { data: RelativeDto }` + `Location` | `201`, `400`, `401`, `422 RELATIVE_LIMIT_REACHED` (cap 200 per user), `422 CONTACT_DETAILS_NOT_ALLOWED` |
| 64 | `GET /kinship/relatives/:id` | `today?` | `{ data: RelativeDto }` | `200`, `400` (uuid), `401`, `404` |
| 65 | `PATCH /kinship/relatives/:id` | `UpdateRelativeDto` (explicit partial of create, minus `lastContactedOn`), `today?` | `200 { data: RelativeDto }` (`nextDueOn` recomputed if schedule fields changed) | `200`, `400`, `401`, `404`, `422` |
| 66 | `DELETE /kinship/relatives/:id` | — | `204` (hard delete; cascades `ContactLog`) | `204`, `401`, `404` |

### 5.3 Contacts — "I contacted them" (67–69)

| # | Endpoint | Request | Response | Codes |
| --- | --- | --- | --- | --- |
| 67 | `POST /kinship/relatives/:id/contacts` | `LogContactDto`: `method` (`ContactMethod`), `contactedOn?` (`YYYY-MM-DD`, default `today`, not later than `today`, not more than 365 days back), `note?`, `today?` | `201 { data: { contact: ContactLogDto, relative: RelativeDto } }` — the updated relative is returned so the client can reconcile its optimistic update in one round-trip | `201`, `400`, `401`, `404`, `422 CONTACT_DETAILS_NOT_ALLOWED` |
| 68 | `GET /kinship/relatives/:id/contacts` | `page`, `limit` | `{ data: ContactLogDto[], meta }`, newest `contactedOn` first | `200`, `401`, `404` |
| 69 | `DELETE /kinship/relatives/:id/contacts/:contactId` | `today?` | `200 { data: RelativeDto }` (undo; recomputed). **A deliberate exception to "delete → 204"**: the client needs the restored due date. | `200`, `401`, `404` |

### 5.4 Due list (70)

`GET /kinship/due` — **user**

- **Query:** `today?` (`YYYY-MM-DD`), `horizonDays?` (int 0–31, default `7`), `lang`
- **Response `200`:**

```jsonc
{
  "data": [
    { "kind": "RELATIVE", "relative": { /* RelativeDto, dueStatus OVERDUE */ } },
    { "kind": "DEED",     "deedReminder": { /* DeedReminderDto */ } }
  ],
  "meta": { "today": "2025-01-14", "horizonDays": 7, "overdueCount": 2, "dueSoonCount": 3, "locale": "ar" }
}
```

- **Semantics:** active rows only, `nextDueOn ≤ today + horizonDays`, ordered `nextDueOn asc` then `name`/deed
  `nameAr`, so the most overdue comes first. Not paginated: it is bounded by the per-user caps (200 relatives, 50
  deed reminders). One indexed query per kind on `(userId, isActive, nextDueOn)`.
- **Codes:** `200`, `400`, `401`

The motivating quote is **not** embedded: the client fetches it from #7 (§2). This keeps the kinship module free
of the quote projection ([backend/.cursorrules](../../backend/.cursorrules): the projection exists exactly once).

### 5.5 Deed reminders (71–75)

| # | Endpoint | Request | Response | Codes |
| --- | --- | --- | --- | --- |
| 71 | `GET /kinship/deed-reminders` | `today?`, `lang` | `{ data: DeedReminderDto[] }` | `200`, `401` |
| 72 | `POST /kinship/deed-reminders` | `CreateDeedReminderDto`: `goodDeedSlug`, `frequency`, `intervalDays?`, `preferredWeekday?`, `today?` | `201 { data: DeedReminderDto }` + `Location` | `201`, `400`, `401`, `404` unknown slug, `409 DEED_REMINDER_EXISTS`, ~~`422 DEED_NOT_ELIGIBLE`~~ (removed — S3 resolved: any deed, [vision-v2 §10](./vision-v2-plan.md#10-reminders-for-any-good-deed--phase-4b-amendment)), `422 DEED_REMINDER_LIMIT_REACHED` (cap 50) |
| 73 | `PATCH /kinship/deed-reminders/:id` | schedule fields, `isActive?` | `200 { data: DeedReminderDto }` | `200`, `400`, `401`, `404` |
| 74 | `DELETE /kinship/deed-reminders/:id` | — | `204` | `204`, `401`, `404` |
| 75 | `POST /kinship/deed-reminders/:id/done` | `doneOn?` (default `today`), `today?` | `200 { data: DeedReminderDto }` | `200`, `400`, `401`, `404` |

~~Eligibility is checked only at creation. A deed that later loses the tag keeps its existing reminders.~~
Superseded: there is no eligibility check — any existing `GoodDeed` slug is accepted
([vision-v2 §10](./vision-v2-plan.md#10-reminders-for-any-good-deed--phase-4b-amendment)).

### 5.6 Calendar feed settings and token (76–79)

| # | Endpoint | Request | Response | Codes |
| --- | --- | --- | --- | --- |
| 76 | `GET /kinship/calendar` | — | `{ data: { isEnabled: boolean, showNames: boolean } }`. **The URL is never returned here** — only its hash is stored (§8). | `200`, `401` |
| 77 | `PATCH /kinship/calendar` | `{ showNames: boolean }` | `200 { data: { isEnabled, showNames } }` | `200`, `400`, `401` |
| 78 | `POST /kinship/calendar/token` | `{ lang?: 'ar' \| 'en' }` (the feed language, baked into the URL) | `201 { data: { webcalUrl, httpsUrl, isEnabled: true, showNames } }`. Creates the token, **or rotates it**: any previous token stops working immediately. **This is the only response that ever contains the token.** | `201`, `401`, `429` |
| 79 | `DELETE /kinship/calendar/token` | — | `204`. Sets `calendarFeedTokenHash = null`; the feed URL now returns `404`. | `204`, `401` |

Token mechanics: `crypto.randomBytes(32)` (**256-bit**, above the 128-bit floor) → base64url (43 chars). The
stored value is `sha256(token)` as hex. A fast hash is correct here: the input is high-entropy random, so a slow
KDF (argon2) only adds CPU to every calendar poll, and lookup needs a deterministic hash for the `@unique` index.
URL shape: `webcal://<api-host>/v1/kinship/calendar/feeds/<token>.ics?lang=ar` (the `httpsUrl` is identical with
`https://`, for clients such as Google Calendar's "From URL").

UX consequence of hashing, stated in the UI: «يظهر الرابط مرة واحدة. لعرضه مجددًا أنشئ رابطًا جديدًا — سيتوقف الرابط
القديم.» The owner mandated hashing, so this is accepted.

### 5.7 The ICS feed (80)

`GET /kinship/calendar/feeds/:token.ics` — **token** (no JWT, no cookie)

- **Response `200`:** `Content-Type: text/calendar; charset=utf-8`, body = the RFC 5545 document (§7). **Not**
  enveloped — see §7.6 for how it bypasses `ResponseEnvelopeInterceptor`.
- **`304`** when `If-None-Match` matches the current `ETag`.
- **`404 RESOURCE_NOT_FOUND`** for an unknown, revoked, rotated-away, malformed or deleted-account token — **never
  `401`/`403`**. The body is identical in every case, so nobody can tell "never existed" from "revoked".
- **`429`** under the per-token throttle (§7.6).
- **Codes:** `200`, `304`, `404`, `429`

### 5.8 Forgotten deeds — public, guest-first (5′, 81)

| # | Endpoint | Query | Response | Codes |
| --- | --- | --- | --- | --- |
| 5′ | `GET /good-deeds` (existing #5) | **new, additive** `tag?` (a `THEME` tag slug, e.g. `forgotten-deeds`). Membership rule in §4.4. | unchanged `{ data: GoodDeedDto[], meta }` | `200`, `400`, `404` unknown tag |
| 81 | `GET /good-deeds/spotlight` | `tag` (required, e.g. `forgotten-deeds`), `period` = `day\|week` (default `week`), `date?` (`YYYY-MM-DD`, the client's local date; default the server's UTC date), `lang` | `{ data: GoodDeedDto \| null, meta: { tag, period, periodKey: "2025-W03", locale } }` — `null` when the tag has no member deeds yet | `200`, `400`, `404` unknown tag |

**Deterministic pick, no identifying seed:** `seed = "${tag}:${period}:${periodKey}"`, where `periodKey` is the
date or its ISO week. Candidates are the member deeds sorted by `id`, and `index = sha256(seed) mod n`. The
service signature takes only `(tag, period, date, lang)` — **no request, IP, user id or token**. This differs on
purpose from the variety seed in [backend-plan §4.2](./backend-plan.md#42-shuffle--variety-mode), which may use an
IP hash. Everyone sees the same deed in the same period, which also makes the response cacheable
(`Cache-Control: public, max-age=3600` from Phase 5). If a deed is added or removed mid-week, the pick may change.
This is accepted.

Route note: `spotlight` is a static segment declared **before** `:slug` in `GoodDeedsController`. `spotlight` is
added to a reserved-slug list in `CreateGoodDeedDto` (`422 SLUG_RESERVED`), so no deed can be shadowed.

### 5.9 Account export and deletion (82–83)

| # | Endpoint | Request | Response | Codes |
| --- | --- | --- | --- | --- |
| 82 | `GET /auth/me/export` | — | `200 { data: { exportedAt, user: { id, email, displayName, createdAt }, favorites: [{ quoteId, createdAt }], relatives: [RelativeDto & { contacts: ContactLogDto[] }], deedReminders: [DeedReminderDto], calendar: { isEnabled, showNames } } }` with `Content-Disposition: attachment; filename="thekra-export.json"` and `Cache-Control: no-store`. **Never** includes `passwordHash`, `calendarFeedTokenHash` or the token. | `200`, `401`, `429` (5/hour) |
| 83 | `DELETE /auth/me` | `{ password }` (re-authentication) | `204`. Deletes the `User` row. Cascades remove `Favorite`, `Relative`, `ContactLog`, `DeedReminder`; the feed hash goes with the row, so the feed 404s at once. | `204`, `400`, `401 INVALID_CREDENTIALS`, `429` |

After deletion, an already-issued access token remains valid for at most 15 minutes, because Phase 4 auth is
stateless ([TECHNICAL_PLAN B6](../TECHNICAL_PLAN.md#b-auth--access)). Any kinship write in that window fails on
the foreign key (`422`) and creates nothing; `/auth/refresh` fails because the user no longer exists. The client
clears its session on the `204`.

### 5.10 DTO notes (kinship-specific; general rules in [backend-plan §5](./backend-plan.md#5-dto--validation-conventions))

| Field | Validators |
| --- | --- |
| `name` | `@IsString() @Length(1, 60) @NoContactDetails()` |
| `note` (relative and contact) | `@IsOptional() @IsString() @MaxLength(280) @NoContactDetails()` |
| `relation`, `frequency`, `method` | `@IsEnum(…)` |
| `intervalDays` | `@IsOptional() @IsInt() @Min(1) @Max(365)`; class-level `@ValidSchedule()`: required iff `CUSTOM`, forbidden otherwise; `preferredWeekday` only with `WEEKLY`/`BIWEEKLY` |
| `today`, `contactedOn`, `lastContactedOn`, `doneOn` | `@IsOptional() @IsISO8601({ strict: true })` restricted to `YYYY-MM-DD` via `@Matches` |
| `showNames` | `@IsBoolean()` |

`@NoContactDetails()` (in `kinship/dto/`, since it is used only here) rejects an email-like string or a run of ≥7
digits, Latin **or** Arabic-Indic (`٠-٩`) and ignoring spaces/dashes, with `422 CONTACT_DETAILS_NOT_ALLOWED`. It
is a guard-rail for the "no phone numbers" rule, not a guarantee. Whether to reject or just warn is open
([S7](#14-open-decisions)). **Validation messages must never interpolate `$value`**: the existing
`validationExceptionFactory` only emits `field`/`constraint`/`message`, and a kinship DTO must not add the
submitted name or note to an error payload.

---

## 6. Backend module placement

### 6.1 `modules/kinship/` — the one new module

| Item | Detail |
| --- | --- |
| Responsibility | A signed-in user's private kinship list, contact logs, forgotten-deed reminders, the due list, and the token-authenticated ICS feed. |
| Owns (writes) | `Relative`, `ContactLog`, `DeedReminder` |
| Writes via another module's service | `User.calendarFeedTokenHash`, `User.calendarShowNames`, through two new `UsersService` methods: `setCalendarFeed(userId, { tokenHash?, showNames? })` and `findByCalendarFeedTokenHash(hash)`. `users` stays the owner of `User`. |
| Reads | `GoodDeed` + membership via `GoodDeedsService` (`findBySlug`, `isInThemeTag(goodDeedId, tag)`) |
| Public exports | `KinshipService` (relatives, contacts, due list, `exportForUser(userId)`), `DeedRemindersService`, `CalendarFeedService` (`rotateToken`, `revokeToken`, `render(tokenHash, lang)`), `KinshipModule` |
| Controllers | `KinshipController` (62–79, `@UseGuards(JwtAuthGuard)` at class level), `KinshipFeedController` (80, **no guard** — the token is the credential, checked in the service) |
| Internal files | `schedule.ts` (pure `computeNextDueOn`, §4.3), `ics/serialize.ts` (§7), `dto/no-contact-details.decorator.ts` |
| Import direction | `kinship → users`, `kinship → good-deeds`. Never the reverse. `auth → kinship` (only for export, §6.2). No `forwardRef`. |
| Registration | `KinshipModule` in `app.module.ts` after `FavoritesModule` ([backend-plan §1.12](./backend-plan.md#112-appmodulets-import-order)). |

### 6.2 Touches to existing modules (small, additive)

| Module | Change |
| --- | --- |
| `good-deeds` | `tag?` filter on #5; `GET /good-deeds/spotlight` (#81); `isInThemeTag()` export; reserved slug `spotlight`. **No new module for forgotten deeds** — it is tags plus good-deeds reads. |
| `users` | The two calendar-feed methods above. |
| `auth` | `GET /auth/me/export` (#82) and `DELETE /auth/me` (#83). `auth` already depends on `users`; it now also calls `FavoritesService.listForExport` and `KinshipService.exportForUser`. Putting export in `auth` rather than `users` avoids a `users ↔ kinship` cycle. |
| `common` | The log serializer change in §6.4. Nothing else. |

### 6.3 What is deliberately *not* added

No scheduler (`@nestjs/schedule` stays a Phase 5 dependency for content sync only), no queue, no push or email
module, no `modules/notifications`, no analytics hook.

### 6.4 Logging and redaction

The feed token travels in the URL path, and the current `nestjs-pino` setup logs `req.url` for every request.
Its `redact` list covers headers and body fields only, and `AllExceptionsFilter` puts `request.url` in
`error.path`. Required changes:

| Where | Change |
| --- | --- |
| `pino-http` `serializers.req` | Mask the path segment after `/kinship/calendar/feeds/` → `[REDACTED].ics` before the request is logged. Unit-test the serializer. |
| `AllExceptionsFilter` | Use the same masking helper for `error.path` and for any logged path. |
| Kinship request bodies | Add `req.body.name`, `req.body.note` to `redact` for defence in depth. pino-http does not log bodies by default, but an error log might. |
| Error logs | Kinship services never log entity fields. Log ids only (`relativeId`), never `name`/`note`. |
| Platform logs | Railway/Vercel edge access logs may still record the path. This residual risk is documented: the token is rotatable, and the feed reveals no names unless `showNames` is on. |

---

## 7. Calendar feed (ICS) generation

### 7.1 Library vs hand-written — recommendation: `ical-generator` (pending approval)

| Option | For | Against |
| --- | --- | --- |
| **`ical-generator` (recommended)** | Handles the parts that are easy to get subtly wrong: CRLF line endings, text escaping (`\\`, `;`, `,`, newlines), and **75-octet line folding that never splits a multi-byte UTF-8 character** — critical when every `SUMMARY` is Arabic. Typed; native ESM (fits the backend's `"type": "module"`); MIT; **no runtime dependencies** (all peers optional); `engines.node` includes Node 24. Latest at the time of writing: 11.1.2. | One new dependency. Must be approved per [backend/.cursorrules](../../backend/.cursorrules) "Dependencies"; listed in [backend-plan §10](./backend-plan.md#10-dependencies-to-add-none-installed-in-this-task). |
| Hand-written serializer | No dependency; the subset needed (all-day `VEVENT`, `RRULE`, `VALARM`) is small. | Octet-based folding of Arabic text, escaping and CRLF have to be written and tested by hand. That is a classic source of feeds that work in one client and break in another. |

If the dependency is rejected, the hand-written fallback is `ics/serialize.ts` (about 100 lines) **plus** the
unit tests in §11.1 (folding, escaping, CRLF), which are mandatory for either option.

### 7.2 Event mapping

All events are **all-day** (`DTSTART;VALUE=DATE`), so the feed needs no `VTIMEZONE` (§7.5).

| Property | Value |
| --- | --- |
| `UID` | **Stable**, so an edit updates the existing event instead of duplicating it. Per relative (names mode): `kin-rel-<relativeId>@thekra`. Per schedule group (generic mode, §7.4): `kin-grp-<first 16 hex of sha256(userId + ":" + groupKey)>@thekra`. Per deed reminder: `kin-deed-<deedReminderId>@thekra`. |
| `DTSTART;VALUE=DATE` / `DTEND;VALUE=DATE` | `nextDueOn` / `nextDueOn + 1 day` |
| `RRULE` | From the frequency table in §7.3. |
| `SUMMARY` | §7.4 |
| `DESCRIPTION` | Generic text («افتح تذكرة لترى من حان وقت وصله.») plus, in names mode, the relation label. **Never the private `note`**, in any mode. |
| `URL` | `<PUBLIC_SITE_URL>/kinship` (or `/good-deeds/<slug>` for a deed) |
| `DTSTAMP` | Generation time. `LAST-MODIFIED` = max `updatedAt` of the rows behind the event. `SEQUENCE` = a monotonic integer derived from that timestamp (for example, minutes since 2024-01-01). |
| `TRANSP` | `TRANSPARENT`, so a reminder never blocks the user's free/busy time. |
| `VALARM` | `ACTION:DISPLAY`, `TRIGGER:PT9H` (09:00 local on the due day), `DESCRIPTION` = the same generic title. See the client caveat in §7.6. |

### 7.3 `RRULE` per frequency

| Frequency | `RRULE` | Note |
| --- | --- | --- |
| `WEEKLY` | `FREQ=WEEKLY;INTERVAL=1;BYDAY=<preferredWeekday or weekday of nextDueOn>` | e.g. `RRULE:FREQ=WEEKLY;BYDAY=FR` |
| `BIWEEKLY` | `FREQ=WEEKLY;INTERVAL=2;BYDAY=<…>` | |
| `MONTHLY` | `FREQ=MONTHLY;INTERVAL=1` | The day comes from `DTSTART`. RFC 5545 **skips** months where that day does not exist (e.g. the 31st), which is why §4.3 caps a monthly due day at 28. |
| `CUSTOM` | `FREQ=DAILY;INTERVAL=<intervalDays>` | |

The recurrence means "if you don't mark this as done, keep reminding me every period". When the user logs a
contact, `nextDueOn` moves forward, the event's `DTSTART` moves with it on the next poll, and the stable `UID`
replaces the old series rather than adding a second one.

### 7.4 Titles: generic by default, names on opt-in

| Mode | `calendarShowNames` | Events | Example `SUMMARY` |
| --- | --- | --- | --- |
| **Generic (default)** | `false` | One recurring event per **schedule group**: relatives sharing `(frequency, intervalDays, BYDAY, nextDueOn)` collapse into one event whose title carries only a count. | «صلة الرحم — ٢ أقارب هذا الأسبوع» (weekly) · «صلة الرحم — قريب واحد هذا الشهر» (monthly) |
| Names | `true` | One recurring event per relative. | «صلة الرحم — خالتي» |
| Deed reminders (both modes) | — | One event per deed reminder; the title is the public deed name. It contains no third-party data. | «عمل منسيّ: <deed nameAr>» |

Titles are rendered server-side in the feed language (`lang` from the URL). Counts use `Intl.PluralRules('ar')`
for Arabic's six plural categories and `Intl.NumberFormat('ar-u-nu-arab')` for Arabic-Indic digits, both built
into Node with no dependency. The final Arabic wording is owner copy; the examples above follow the brief.
`X-WR-CALNAME`: «تذكرة — صلة الرحم».

### 7.5 Timezones

All-day `VALUE=DATE` events are *floating*: they land on that calendar date in whatever timezone the device is
in. The server stores no timezone and emits no `VTIMEZONE`. "Today" for the due list comes from the client (§4.3).
The `TRIGGER:PT9H` alarm is relative to local midnight of the due day, so it fires at 09:00 local time everywhere.

### 7.6 HTTP behaviour of the feed

| Concern | Decision |
| --- | --- |
| Envelope bypass | The global `ResponseEnvelopeInterceptor` wraps any non-`{ data }` return value, including a string. `KinshipFeedController` therefore writes the response itself with `@Res()` (not `passthrough`): `res.type('text/calendar; charset=utf-8').send(ics)`. The interceptor is not modified. |
| Route syntax | `feeds/:token.ics` — **verify the parameter-with-suffix syntax against the installed Express/Nest router at implementation time**. The fallback is `feeds/:file`, with the service validating and stripping `.ics`. |
| Headers | `Content-Disposition: inline; filename="thekra-kinship.ics"`, `Cache-Control: private, no-cache`, `ETag` (hash of user id + max `updatedAt` + `showNames` + `lang`) → `304` on match, `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer`. Calendar header hints: `REFRESH-INTERVAL;VALUE=DURATION:PT6H` (RFC 7986) and `X-PUBLISHED-TTL:PT6H`. |
| Throttling | **Per token hash**, not per IP: Google's calendar fetchers poll many users' feeds from shared IPs, so an IP limit would block everyone. Suggested limit: 60 requests per hour per token, plus the generous global limit ([backend-plan §2.7](./backend-plan.md#27-other-global-conventions)). A 256-bit token makes enumeration infeasible regardless. |
| Empty list | A valid, empty `VCALENDAR` with `200`, so a subscription never "breaks". |
| Client caveats (verify on devices) | Calendar apps may **ignore or strip alarms in subscribed feeds**. Some clients (Google Calendar, in common experience) use the calendar's own default notification settings instead. The subscribe screen therefore tells the user to set a default notification for the subscribed calendar. The Phase 4b "done when" requires a real-device check on iOS and Google Calendar. |

Example (generic mode, one weekly group; lines shown unfolded):

```text
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Thekra//Kinship Reminders//AR
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:تذكرة — صلة الرحم
REFRESH-INTERVAL;VALUE=DURATION:PT6H
X-PUBLISHED-TTL:PT6H
BEGIN:VEVENT
UID:kin-grp-3f9c2a7d10b4e8c1@thekra
DTSTAMP:20250114T080000Z
LAST-MODIFIED:20250110T191200Z
SEQUENCE:534672
DTSTART;VALUE=DATE:20250117
DTEND;VALUE=DATE:20250118
RRULE:FREQ=WEEKLY;BYDAY=FR
SUMMARY:صلة الرحم — ٢ أقارب هذا الأسبوع
DESCRIPTION:افتح تذكرة لترى من حان وقت وصله.
URL:https://<site>/kinship
TRANSP:TRANSPARENT
BEGIN:VALARM
ACTION:DISPLAY
TRIGGER:PT9H
DESCRIPTION:صلة الرحم
END:VALARM
END:VEVENT
END:VCALENDAR
```

---

## 8. Privacy

This feature stores **personal data about third parties** — the user's relatives, who never agreed to be in any
app. The bar is therefore higher than for favorites.

| Principle | Rule |
| --- | --- |
| **Collect the minimum** | Display name/nickname, relation, frequency (+ interval/weekday), and an optional short private note. **No phone numbers, addresses, emails, birthdays or photos of relatives** — the user's phone already has them. A validator guards `name`/`note` (§5.10), and the form copy says so: «اكتب اسمًا أو لقبًا فقط — لا تكتب رقم الهاتف أو العنوان.» |
| **Never logged** | No kinship field in any log line. Ids only. Feed token masked (§6.4). |
| **Never in analytics** | There is no analytics ([TECHNICAL_PLAN §I.10](../TECHNICAL_PLAN.md#i-standing-assumptions)). If any is ever added, kinship routes and payloads are excluded by rule, as sin selections are. |
| **Never in error payloads** | Validation messages never echo values (§5.10). `error.path` is masked for the feed. 5xx bodies are already generic ([backend-plan §2.5](./backend-plan.md#25-errors--exception-filter-shape)). |
| **Never in page metadata** | `/kinship*` pages use generic `<title>`s and are `noindex`. A relative's name never appears in a title, URL, toast or browser history entry. URLs use UUIDs. |
| **Cascade-deleted with the user** | `onDelete: Cascade` on every kinship relation (§4.1); `DELETE /auth/me` (#83) removes everything, including the feed. |
| **Exportable** | `GET /auth/me/export` (#82) returns every row the user stored, in readable JSON. |
| **Calendar feed is generic by default** | Titles carry counts, not names, unless the user opts in. The opt-in screen says explicitly: «عند تفعيل الأسماء، ستُخزَّن أسماء أقاربك لدى مزوّد التقويم (Google أو Apple أو غيرهما) وقد تظهر على شاشة القفل.» — **calendar providers store whatever the feed contains**, under their own privacy terms. Notes are never in the feed. |
| **Feed token** | Random 256-bit, stored only as SHA-256, rotatable (#78) and revocable (#79), shown once. Unknown or revoked → `404`, never `401`. Per-token throttle. The QR code is rendered **locally** in the browser — never via a third-party QR API, which would leak the token. |
| **Shared devices** | On sign-out the client removes every `['kinship', …]` query from the cache. The feed URL is never written to `localStorage`. |
| **Separate from sins** | The kinship module never touches `Sin`, `SinQuote` or any record of what a user viewed. The privacy-of-intent rule for sins ([TECHNICAL_PLAN §I.7](../TECHNICAL_PLAN.md#i-standing-assumptions)) is unchanged and is not weakened by this feature. |
| **Not user-generated *content*** | Names and notes are private, owner-only data. They are never published, shared, displayed to anyone else, or moderated ([TECHNICAL_PLAN §I.10](../TECHNICAL_PLAN.md#i-standing-assumptions)). |

---

## 9. Frontend

Follows [frontend-plan §2](./frontend-plan.md#2-route-map), [§3.3](./frontend-plan.md#33-where-composed-components-live--the-rule-that-protects-the-design-swap)
and [§6](./frontend-plan.md#6-state--data-fetching-plan), [frontend/.cursorrules](../../frontend/.cursorrules) and
[design-system.mdc](../../frontend/.cursor/rules/design-system.mdc).

### 9.1 Routes

| Route | Owning slice | Auth | Renders | API |
| --- | --- | --- | --- | --- |
| `/kinship` | `kinship` | **user** — anonymous visitors see the shared `SignInPrompt` (no redirect) | «صلة الرحم» header; **due section** (overdue, then due this week) with a "تواصلت معه" action per row; one motivating `QuoteCard` (§2); full relatives list; forgotten-deed reminders; "add relative" opens `RelativeFormSheet`; a link to `/kinship/calendar` | #70, #62, #71, #7 |
| `/kinship/[relativeId]` | `kinship` | user | Relative detail, contact history, edit, pause/resume, delete (confirm `Dialog`) | #64, #68, #69, #65, #66 |
| `/kinship/calendar` | `kinship` | user | What the feed is and its privacy trade-off; "create link" → copyable `webcal://` and `https://` links + locally rendered QR; generic/names setting; rotate and revoke (each behind a confirm `Dialog`); "set a default notification for this calendar" guidance | #76–#79 |
| `/` *(addition)* | `good-deed-motivation` | guest | `ForgottenDeedSpotlight` card: the deed of the week, linking to `/good-deeds/[slug]` | #81 |
| `/good-deeds?tag=forgotten-deeds` *(addition)* | `good-deed-motivation` | guest | A "الأعمال المنسية" filter chip on the existing catalogue (URL state). A signed-in user also sees "add to my reminders" on **every** deed's page (S3 resolved — [vision-v2 §10](./vision-v2-plan.md#10-reminders-for-any-good-deed--phase-4b-amendment)). | #5′, #72 |
| `/settings` *(addition)* | `components/shared` | user section | "Export my data" (downloads #82) and "Delete my account" (password re-entry, #83) | #82, #83 |

All `/kinship*` routes: Client Components, `dynamic = 'force-dynamic'`, `robots: { index: false }`, generic
`generateMetadata` titles.

### 9.2 Feature slice `features/kinship/` (new slice — owner approval needed)

[frontend/.cursorrules](../../frontend/.cursorrules) fixes the existing slice names. This is a **new** slice,
added the same way `features/curation` is planned for phase 6.

```
features/kinship/components/   DueList, DueListItem, DueListSkeleton, MarkContactedButton (+ method popover),
                               RelativeList, RelativeFormSheet, ContactHistory, DeedReminderList,
                               KinshipMotivation, CalendarSubscribeCard, FeedLinkField, FeedQrCode,
                               ShowNamesSetting
features/kinship/hooks/        useKinshipDue, useRelatives, useRelative, useCreateRelative, useUpdateRelative,
                               useDeleteRelative, useLogContact, useUndoContact, useContactHistory,
                               useDeedReminders, useCreateDeedReminder, useMarkDeedDone,
                               useCalendarFeed, useRotateCalendarToken, useRevokeCalendarToken,
                               useUpdateCalendarSettings, useKinshipMotivation
features/good-deed-motivation/components/  + ForgottenDeedSpotlight, ForgottenDeedsFilterChip
```

Layering rules applied:

- `KinshipMotivation` renders the **shared** `QuoteCard`. `useKinshipMotivation` calls `getGoodDeedQuotes` from
  `lib/api/good-deeds.ts` with the **same** `queryKeys.goodDeeds.quotes(...)` key. It does not import
  `good-deed-motivation`'s hooks, because slices never import each other's internals.
- `SignInPrompt` is currently planned inside `features/favorites/`. Since `/kinship` needs it too, it is
  **promoted to `components/shared/auth/`**, as the layering rule requires.
- `useLogContact` is an **optimistic** mutation: move the row out of the due list and set `lastContactedOn = today`,
  snapshot → rollback on error → invalidate `queryKeys.kinship.all` on settle, plus a `sonner` toast with an
  **«تراجع» (undo)** action that calls #69. [frontend/.cursorrules](../../frontend/.cursorrules) currently sanctions
  only `useToggleFavorite` as an optimistic exception, so this is a **second sanctioned exception, pending owner
  approval and a rules-file update**.
- Forms: `react-hook-form` + `zod` via the shadcn `form` primitive (Phase 4). The zod schema mirrors `@ValidSchedule`:
  `intervalDays` only for `CUSTOM`, `preferredWeekday` only for weekly/biweekly.
- "Contacted on another day" uses the `input` primitive with `type="date"`. No `calendar`/`date-picker` primitive
  is pulled forward. A setting toggle may use `switch` if the owner approves `shadcn add switch`; otherwise
  `toggle-group`.

### 9.3 Data layer

- `lib/api/kinship.ts`: one function per endpoint #62–#79. `lib/api/good-deeds.ts` gains `getGoodDeedSpotlight`
  and the `tag` param. `lib/api/auth.ts` gains `exportMyData`, `deleteAccount`.
- `lib/types/api.ts`: `RelativeDto`, `ContactLogDto`, `DeedReminderDto`, `DueItem` (discriminated on `kind`),
  `CalendarFeedDto`. `lib/types/enums.ts`: `KinRelation`, `ReminderFrequency`, `Weekday`, `ContactMethod` as
  `const` objects.
- `query-keys.ts`:

```ts
kinship: {
  all: ['kinship'] as const,
  due: (p: KinshipDueQuery) => ['kinship', 'due', p] as const,
  relatives: (p: RelativesQuery) => ['kinship', 'relatives', p] as const,
  relative: (id: string) => ['kinship', 'relative', id] as const,
  contacts: (id: string, p: PageQuery) => ['kinship', 'relative', id, 'contacts', p] as const,
  deedReminders: ['kinship', 'deed-reminders'] as const,
  calendar: ['kinship', 'calendar'] as const,
},
goodDeeds: { /* existing */ spotlight: (p: SpotlightQuery) => ['good-deeds', 'spotlight', p] as const },
```

- `today` is computed once from the device (`YYYY-MM-DD` in local time) and injected by the `api/kinship.ts`
  functions. It is part of the `due` key, so the list rolls over at local midnight.
- Sign-out handler: `queryClient.removeQueries({ queryKey: queryKeys.kinship.all })`.
- **Not in Zustand:** nothing kinship-related. The one-time feed URL lives in the mutation result (component
  memory) only.

### 9.4 States, RTL and design-system compliance

| Requirement ([design-system.mdc](../../frontend/.cursor/rules/design-system.mdc)) | Applied |
| --- | --- |
| Loading | `DueListSkeleton` and the relatives-list skeleton match row geometry; `QuoteCardSkeleton` for the motivation. No spinner where a list will appear. |
| Empty | Shared `EmptyState`: no relatives → «لم تُضِف أحدًا بعد» + "add relative"; nothing due → «لا أحد متأخر — بارك الله فيك» (copy to be finalised by the owner). |
| Error | Shared `ErrorState` with `onRetry` on every query-backed region. Never a silent `return null`. |
| No colour-only state | Overdue = icon + text badge («متأخر ٣ أيام»), not just a colour. Uses existing semantic tokens only — **no new token** and no literal colour. A distinct kinship tone, if wanted, is a design-day token request. |
| RTL | Logical utilities only. Dates through `Intl.DateTimeFormat`/`RelativeTimeFormat` with the locale and the Arabic-Indic numeral preference ([frontend-plan §5.3](./frontend-plan.md#53-dir-handling)). The `webcal://` link is wrapped in `<bdi dir="ltr">`. |
| Motion / INP | Optimistic removal from the due list uses opacity only, with `motion-reduce` respected. No layout animation. |
| a11y | `MarkContactedButton` is a real `<button>` whose accessible name includes the relative's name (on-screen only). An `aria-live` region announces «سُجِّل التواصل». Confirm dialogs have `DialogTitle`/`DialogDescription`. The QR has a text alternative pointing at the copy button. |
| i18n | Every string in `messages/ar.json` (primary) + `en.json`. ICU plurals for counts (Arabic's six categories). Relation and method labels are UI keys; **names are user data rendered verbatim**, never translated. |

---

## 10. Mobile (Phase 7)

Short note only — see [mobile-plan §3.2](./mobile-plan.md#32-phase-4b-reminders--on-device-local-notifications).
The Expo app reads the same endpoints and schedules **local** notifications on the device with
`expo-notifications`. On mobile this replaces reliance on the calendar feed; the feed stays available as an
option. No push server is introduced.

---

## 11. Testing

Style and file layout as in [backend-plan §11](./backend-plan.md#11-testing-strategy-vitest-already-configured).

### 11.1 Unit tests (must-have)

| Module / file | Non-negotiable tests |
| --- | --- |
| `kinship/schedule.ts` | weekly/biweekly/custom add the right days; monthly from the 31st → the 28th of next month; December → January; `preferredWeekday` snaps **forward** 0–6 days, never backward; a new relative with no contact is due `today` (snapped); a backdated contact older than `lastContactedOn` does not move it backwards |
| `KinshipService` | another user's relative → `NotFoundException` (not forbidden); `CUSTOM` without `intervalDays` → 400; `intervalDays` with `WEEKLY` → 400; `preferredWeekday` with `MONTHLY` → 400; `contactedOn` after `today` → 400; undo restores `lastContactedOn` to the max remaining log (or `null` → due today); cap 200 → `RELATIVE_LIMIT_REACHED`; `today` outside ±1 day of server UTC falls back to the server date; due list orders most-overdue first and merges deed reminders |
| `@NoContactDetails()` | rejects `+966 50 123 4567`, `0501234567`, `٠٥٠١٢٣٤٥٦٧`, `a@b.co`; accepts «خالتي أم محمد», «جدي» |
| `DeedRemindersService` | any deed accepted (S3 resolved, e.g. `sadaqah`); unknown slug → `404`; duplicate → `409`; `done` advances `nextDueOn`; cap 50 |
| `CalendarFeedService` | token is ≥32 random bytes base64url; **only** `sha256(token)` is persisted; rotate replaces the hash (old token → not found); revoke nulls it; unknown/revoked/malformed tokens raise the **same** not-found error |
| `ics/serialize` | CRLF line endings; no line over 75 octets **and no split UTF-8 sequence** in an Arabic `SUMMARY`; `,` `;` `\` and newlines escaped; `UID` identical across two renders after an edit; `RRULE` per frequency matches §7.3; `showNames=false` → **no fixture name appears anywhere in the output**; `note` never appears in either mode; generic grouping counts correctly; an empty list → a valid empty `VCALENDAR` |
| `GoodDeedsService` (additions) | `tag` filter includes a deed iff a linked, grade-policy-renderable quote carries the tag (a `MAWDU`-only link does **not** qualify); spotlight: same `(tag, period, date)` → same deed; every date in one ISO week → the same deed; the pick function's inputs are only `tag/period/date` (no request/IP/user); a tag with no members → `null` |
| `common` (logging) | the request serializer masks `/kinship/calendar/feeds/<token>.ics`; `AllExceptionsFilter` masks `error.path` the same way |
| `auth` (additions) | export contains relatives, contacts, deed reminders and favorites, and **never** `passwordHash`/`calendarFeedTokenHash`; delete with a wrong password → `INVALID_CREDENTIALS` |

### 11.2 E2E tests — `backend/test/kinship.e2e-spec.ts` (+ additions to `good-deeds`, `auth`)

- Every `/v1/kinship/*` route except the feed → `401` without a token; the envelope shape on every `200`/`201`.
- User B gets `404` on user A's relative for GET, PATCH, DELETE and contacts.
- Create → `201` + `Location`, `nextDueOn` present; log a contact → `nextDueOn` advances; undo (#69) → `200` with
  the previous `nextDueOn`.
- `GET /kinship/due?today=…` with fixtures at known dates → overdue first, horizon respected, deeds included.
- Feed: valid token → `200`, `Content-Type` starts with `text/calendar`, body starts with `BEGIN:VCALENDAR` and
  contains `RRULE:`; default body contains **no** relative name; after `PATCH showNames=true` it does; `ETag`
  round-trip → `304`; unknown token → `404` with a body identical to the revoked-token body; rotate → old `404`,
  new `200`; revoke → `404`.
- `DELETE /auth/me` → `204`, then zero `Relative`/`ContactLog`/`DeedReminder` rows for that user and the feed `404`s.
- `GET /auth/me/export` → `200`, `Content-Disposition: attachment`, contains fixture relatives and contacts, no
  hash fields.
- `GET /good-deeds/spotlight?tag=forgotten-deeds&date=2025-01-14` without a token → `200`, deterministic for that
  date; `GET /good-deeds?tag=forgotten-deeds` lists only member deeds.
- **Log capture:** with pino writing to an in-memory stream, request a feed and create a relative named «خالتي
  فاطمة»; neither the token nor the name appears in the captured output.
- Fixtures use **synthetic test content** for forgotten deeds. No real religious text is invented for tests.

### 11.3 Frontend

| Layer | Cases |
| --- | --- |
| Hooks (Vitest + `msw`) | `useLogContact` optimistic removal + rollback on `500` + invalidation on settle; undo calls #69; `useKinshipDue` key includes `today`; sign-out clears `['kinship']` queries |
| Components | `RelativeFormSheet` zod rules (`CUSTOM` ⇒ `intervalDays`); `DueList` loading/empty/error states; `CalendarSubscribeCard` never writes the URL to `localStorage`, and the QR makes **no network request** (msw sees none) |
| E2E (Playwright, `ar` + `en`) | guest → `/kinship` shows `SignInPrompt`, while home shows the forgotten-deed spotlight; sign in → add relative → appears due → "تواصلت معه" → leaves the due list → undo → returns; create feed link → copy works → `/settings` export downloads JSON |

---

## 12. Build order for Cursor

Entry condition: **Phase 4 shipped** (real JWT auth, `JwtAuthGuard`, `users`, `favorites`) **and** the owner has
approved §4 (schema), §7.1 (`ical-generator`), the new module and slice, and the open decisions in §14 that block
code (S1, S2, S3).

1. Migration `add_kinship_reminders` (own commit), seed: the `forgotten-deeds` `THEME` tag + dev relatives for the
   two seed users. No invented religious content — forgotten-deed quotes come from the owner's curation.
2. `kinship/schedule.ts` + its unit tests (pure, no Nest).
3. `UsersService` feed methods; `GoodDeedsService.isInThemeTag`, the `tag` filter on #5, spotlight #81.
4. `KinshipService` + `KinshipController` (#62–#70), then `DeedRemindersService` (#71–#75).
5. Logging masks (§6.4) **before** the feed route exists.
6. `ics/serialize` + `CalendarFeedService` + `KinshipFeedController` (#76–#80).
7. `auth` export/delete (#82–#83).
8. Frontend: promote `SignInPrompt`; `lib` types/api/keys; `features/kinship` hooks → `/kinship` → `/kinship/[relativeId]`
   → `/kinship/calendar`; `ForgottenDeedSpotlight` on `/`; filter chip; settings export/delete.
9. Real-device verification of the feed on iOS Calendar and Google Calendar (§13).

---

## 13. Done when

- A signed-in user can add «خالتي» weekly on Friday, see her in "due this week", tap "تواصلت معه", watch her leave
  the list, undo, and see her return — in `ar` (RTL) and `en` (LTR), with no colour-only state and every region
  having loading/empty/error states.
- `/kinship` shows one motivating صلة الرحم text through the shared `QuoteCard`, served by
  `GET /v1/good-deeds/silat-ar-rahim/quotes`, with grade and provenance visible.
- Subscribing the `webcal://` link in **iOS Calendar** and in **Google Calendar** produces recurring all-day
  events with generic titles. After "تواصلت معه", the next poll moves the event and creates no duplicate. Alarm
  behaviour per client is recorded in the PR (feed alarm honoured, or the calendar default used).
- Turning names on/off changes the titles on the next poll. A revoked or rotated link returns `404`. The token
  never appears in any application log.
- A guest sees the forgotten deed of the week on `/` with no account, and the same deed for every visitor that week.
- A signed-in user can opt a forgotten deed into reminders, and it appears in the due list and the feed.
- `GET /v1/auth/me/export` returns all kinship data; `DELETE /v1/auth/me` leaves zero kinship rows and a dead feed.
- Every core flow still works with no account. No sin-related data is touched by any kinship code path.
- All §11 tests pass. CI is green, including the migration drift check.

---

## 14. Open decisions

Genuinely open items. Each has a default so implementation is not blocked once the owner confirms.

| # | Question | Default | Why / what changes if revisited |
| --- | --- | --- | --- |
| S1 | **How is a deed marked "forgotten"?** | Derived: the deed has a renderable linked quote tagged `forgotten-deeds` (§4.4), with no schema change | It honours "reuse the existing model", but it is indirect. The alternative is a proposed `GoodDeedTag` join (or `GoodDeed.isForgotten`): explicit, but another schema change to approve. |
| S2 | **Which relations are offered?** Are in-laws (أصهار) included? | The §4.1 list; in-laws are not a separate value (`OTHER` covers them) | Who counts as رحم is a content/fiqh question for the owner; adding an enum value later is additive. |
| S3 | Can **any** good deed be put on a reminder, or only forgotten deeds? | **Resolved → any `GoodDeed`** (الصدقة and other acts of worship the owner adds); `DEED_NOT_ELIGIBLE` removed. Owner to confirm ([vision-v2 V12](./vision-v2-plan.md#15-owner-decisions)). | The owner's updated vision asks for periodic reminders of sadaqa and other acts of worship, not only forgotten deeds. Details: [vision-v2-plan.md §10](./vision-v2-plan.md#10-reminders-for-any-good-deed--phase-4b-amendment). |
| S4 | **ICS library or hand-written?** | `ical-generator` (pending approval) | §7.1. Rejecting it means a hand-written serializer with the same tests. |
| S5 | **QR code on the subscribe screen** | Keep it, rendered locally via a small frontend dependency (`qrcode.react`, pending approval) | Useful when subscribing a phone from a desktop. Dropping it removes a dependency; the copy buttons remain. |
| S6 | **Alarm in the feed** | `VALARM` at 09:00 local on the due day | Some clients ignore feed alarms anyway. The time could become a user setting later (one column). |
| S7 | **Contact-details guard: reject or warn?** | Reject (`422 CONTACT_DETAILS_NOT_ALLOWED`) | A warning is friendlier but lets phone numbers in. Rejecting can misfire on a note containing a long number. |
| S8 | Field names `lastContactedOn`/`nextDueOn` vs the brief's `lastContactedAt`/`nextDueAt` | `…On`, because they are `@db.Date` | Naming only; keeping `…At` with a date type is possible but misleading. |
| S9 | Per-user caps | 200 relatives, 50 deed reminders | Abuse and feed-size guard; trivially changed. |
| S10 | **`ContactLog` retention** | Keep the latest 50 per relative, trimmed in the same write transaction | Minimum-data principle. Keeping everything gives a longer history; trimming more aggressively gives less. |
| S11 | Monthly due day capped at 28 | Yes (§4.3) | Avoids RFC 5545 skipping short months. The alternative is a `BYMONTHDAY=-1`-style rule with weaker client support. |
| S12 | Feed language | Chosen when the link is created (`?lang=` baked into the URL) | Changing language means creating a new link. A stored user locale would avoid that, at the cost of one more column. |

**Owner actions outside `docs/` (not done by this plan):** after approval,
[backend/.cursorrules](../../backend/.cursorrules) needs `modules/kinship/` in its module list and the Phase 4b
schema in its "pre-approved" list. [frontend/.cursorrules](../../frontend/.cursorrules) needs the `kinship` slice
and the `useLogContact` optimistic exception. Until then, Cursor will (correctly) stop and ask.

---

## 15. Dependencies and configuration

| Where | Item | Status |
| --- | --- | --- |
| backend | `ical-generator` (`^11`) | **Phase 4b, pending approval** — [backend-plan §10](./backend-plan.md#10-dependencies-to-add-none-installed-in-this-task) |
| frontend | `qrcode.react` (or an equivalent local renderer) | **Phase 4b, pending approval** — [frontend-plan §8](./frontend-plan.md#8-dependencies-to-add-nothing-installed-in-this-task) |
| frontend | `switch` primitive via `shadcn add switch` | optional, ask first |
| backend env | `PUBLIC_API_URL` | needed to build the `webcal://`/`https://` feed URLs behind a proxy |
| backend env | `PUBLIC_SITE_URL` | the event `URL` back to `/kinship` |

When implemented, the two env vars go into `backend/.env.example` and [devops-plan §5.1](./devops-plan.md#51-backend-variables)
in the same PR ([devops-plan §5.3](./devops-plan.md#53-practices): templates stay current). No new infrastructure:
no Redis, no queue, no push or email provider, no cron.
