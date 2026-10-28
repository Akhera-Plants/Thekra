# @thekra/practice-core

Shared engine for Thekra's reminders, habit plans («أعِنّي على طاعة»), sin-leaving program («ترك المعصية») and
kinship list (صلة الرحم). Pure TypeScript, zero runtime dependencies, ESM, no build step (`exports` points at
`src/index.ts`). Meant for the web app (Next.js `transpilePackages`), the browser extension (esbuild), the mobile
app (Expo/Metro) and the backend (esbuild bundle). Plan: [docs/plan/2026-10-features-roadmap.md §1](../../docs/plan/2026-10-features-roadmap.md).

```sh
pnpm --filter @thekra/practice-core test       # vitest run
pnpm --filter @thekra/practice-core typecheck  # tsc --noEmit
```

## Conventions

- Calendar days are local `YYYY-MM-DD` strings and times are `HH:MM`. The API never takes a `Date` for a day; call
  `todayFrom(new Date())` once at the edge of the app. Arithmetic is time-zone and DST independent.
- Every function is pure: inputs are never mutated, new objects are returned.
- Only ES2022 plus `Intl.DateTimeFormat` with the `islamic-umalqura` calendar. No Node or DOM APIs.
- Relative imports are extension-less (`./dates`), which bundlers and `moduleResolution: bundler` accept.

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
| `storage` | `Store` (`v: 1`), `emptyStore`, `parseStore` (never throws, drops invalid entries), `serializeStore`, `exportForSync` (no `programs`) |

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

- **Sin-program data is local only** (roadmap §0.1): never sync it, send it to a server, back it up to our cloud,
  log it or use it in analytics, notification text or calendar titles. `exportForSync` has no `programs` key, and
  `parseStore` copies only known fields so nothing can ride along.
- Kinship names are nicknames only. `looksLikeContactDetails` rejects phone numbers (≥ 7 digits, Latin,
  Arabic-Indic or Persian), emails and links; `validateRelative` applies it to `name` and `relation`.
