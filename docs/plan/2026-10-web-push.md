# Web push reminders (temporary design for Vercel Hobby)

> Owner decision, 2026-10-28: web push now, built on Upstash QStash as the timer, **temporarily** until the API
> moves to a long-lived server (Hetzner or similar). When that move starts, follow
> [docs/deploy/MIGRATION_OFF_VERCEL.md](../deploy/MIGRATION_OFF_VERCEL.md) — the owner asked to be reminded.

## 1. Why this shape

- Vercel Hobby cron runs **once a day**, up to 59 minutes late, so it cannot fire a reminder at 09:30.
- A timer that wakes the API every minute would also wake the free Neon database every minute: it never scales to
  zero, burns the monthly compute allowance, and when that runs out the **whole site** stops.
- So each reminder is handed to QStash with its send time. At that time QStash calls `POST /v1/push/deliver`, and
  the API sends the notification **without reading the database**: everything needed travels in the message, sealed
  with AES-256-GCM (key derived from the VAPID private key), so Upstash cannot read the endpoint or the text.
- The database is touched only when the user syncs (it is awake anyway), when a browser subscribes, and once a day
  by the Vercel cron that tops up the next 48 hours.

## 2. Data

| Model | Columns | Notes |
| --- | --- | --- |
| `PushSubscription` | `id`, `userId`→User (cascade), `endpoint` (unique), `p256dh`, `auth`, `timeZone` (IANA), `locale` (`ar`/`en`), `prefs Json?`, timestamps | one per browser; max 10 per user (oldest dropped); `prefs` = this browser's «التنبيهات» switches (2026-11-01, migration `20261101090000_push_subscription_prefs`; null = defaults) |
| `PushReminder` | `id`, `subscriptionId`→PushSubscription (cascade), `key`, `digest`, `fireAt`, `messageId` | `@@unique([subscriptionId, key])`; what is scheduled at QStash |

`key` = `habit:<planId>:<date>:<time>`, `kinship:<date>`, `evening:<date>`, `friday:<date>`, `occasion:<date>` (round 5) or `digest:<date>` (`strategy:<date>` until round 5); `digest` changes when the time, title, text or link
changes. A re-plan cancels rows that are gone or changed, publishes what is new and deletes rows already fired.

## 3. API

All `private, no-store`. Responses use the usual `{ data }` envelope.

| Route | Auth | Body | Answer |
| --- | --- | --- | --- |
| `GET /v1/push/config` | none | — | `{ enabled, publicKey }` (`publicKey` = VAPID public key, base64url; `null` when off) |
| `POST /v1/me/push/subscriptions` | JWT | `{ endpoint, keys: { p256dh, auth }, timeZone, locale, prefs? }` (the browser's `subscription.toJSON()` plus zone, language and the optional switches `{ habits, periodic, periodicTime, eveningNudge, eveningTime, fridayReview, fridayTime, reviewDay, occasions, occasionTime, anchorTimes? }` (round 5; `strategies` / `strategyTime` are still accepted from older builds and ignored); an absent `prefs` keeps what is stored. `anchorTimes` (phase 6) =
`{ 'YYYY-MM-DD': { 'after-fajr': 'HH:MM', … every anchor } }` for at most 30 days, resolved by the browser from its own
AlAdhan cache (practice-core `resolvedAnchorTimes`, 14 days sent): the server cannot call AlAdhan per user, so anchored
habit slots use these times and fall back to the default anchor times on days without an entry) | `{ id, scheduled }`; 503 `PUSH_DISABLED` when off; 400 `PUSH_INVALID` for an unknown zone |
| `DELETE /v1/me/push/subscriptions` | JWT | `{ endpoint }` | 204 (idempotent) |
| `POST /v1/me/push/test` | JWT | `{ endpoint, locale }` | 204 after sending one notification now; 404 when the browser is not registered or dropped it |
| `POST /v1/push/deliver` | QStash signature (`Upstash-Signature`) | sealed text (`text/plain`) | 200 `{ outcome }` |
| `GET /v1/push/refill` | `Authorization: Bearer $CRON_SECRET` (Vercel cron, daily) | — | `{ users, complete }` |

Re-planning also runs after every `POST /v1/me/practice/sync`, and the account deletion cancels everything first.

## 4. What a notification says

**Policy (phase 4, 2026-11-01):** the planner calls practice-core `notificationPlan`, the same policy as the app's local
notifications and the extension's alarms: habits at their slots (the second only while the day is not done; one slot
once «راسخة»; a periodic plan once per due day), people lists once per due day, the evening nudge (opt-in, at
`eveningTime`, only while a habit asked that day is not done), the Friday review reminder (on by default, `fridayTime`
17:00), quiet hours 23:00–05:00 (except the night prayer `qiyam-last-third` and slots that are not the catalog's
suggestions), at most 4 a day and the rest as one digest «عندك n أعمال اليوم». Texts: practice-core `NOTIFY_TEXTS`;
`url` = `/<locale>/practice`, `tag` = `evening` / `friday` / `digest`. «ذكّرني بها» (phase 5) was removed in round 5
(F-12 a): stored prefs that still hold strategies plan nothing. «مناسبة قريبة» (round 5, opt-in, `occasions` /
`occasionTime`): the day before a non-weekly occasion of the catalog (deed-schedules.yaml) starts, `tag` = `occasion`,
`url` = `/<locale>/good-deeds/<deed>`, outside the daily cap. The private moment never reaches the server.


The service worker receives JSON `{ title, body, url, tag }` and shows it; a click focuses an open tab of the site or
opens `url`.

- Habit: title = the habit's name, body = «المطلوب اليوم: …» / "Today: …", `url` = `/<locale>/practice`, `tag` =
  `habit-<planId>` (a newer one replaces the older). Today's remaining slots are cancelled once the day is logged.
- Kinship: «صلة الرحم» with a count only, never names; `url` = `/<locale>/practice/kinship`; time 18:00.
- The sin program never reaches web push: the server cannot read it.

## 5. Browsers

- Chrome, Edge, Firefox, Safari on macOS: from the page.
- iPhone/iPad: only after «أضف إلى الشاشة الرئيسية» (iOS 16.4+), opened from the home-screen icon. The page says so.
- The web app re-sends its subscription on each signed-in visit (keys rotate, the zone may change), and removes it on
  sign-out.

## 6. Limits to watch

- QStash free plan has a daily message quota; each reminder is one message per browser. The planner caps 40 per
  browser per 48 hours. A refused publish is logged (no content) and retried at the next re-plan.
- Vercel cron runs only on the production deployment.

## 7. Environment

`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PUSH_PUBLIC_API_URL`, `QSTASH_TOKEN`, `QSTASH_URL`
(optional), `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, `CRON_SECRET` — see
[docs/deploy/VERCEL.md](../deploy/VERCEL.md). With any of them missing, push is off and the web page hides it.
