# Moving the API off Vercel (Hetzner or similar) — read before starting

> **تذكير للمالك (طلبه بنفسه، 2026-10-28):** أول ما نبدأ بالنشر على Hetzner أو غيره، لازم نعدّل إشعارات الويب
> (حاليًا مؤقتة على Upstash QStash وكرون فيرسل اليومي) ونرتب البنود تحت. أي جلسة تبدأ بنقل السيرفر تقرأ هاد الملف
> وتذكّر المالك فيه قبل أي خطوة.

Everything below exists only because the API runs on Vercel Hobby with a free Neon database. Each item says what to
change when the API runs on a long-lived server.

## 1. Web push timer (must change)

Today (docs/plan/2026-10-web-push.md): each reminder is handed to **Upstash QStash** with its send time; QStash calls
`POST /v1/push/deliver`; a **Vercel cron** (`backend/vercel.json` → `crons`, once a day) tops up the next 48 hours.

On a long-lived server:

1. Implement `PushScheduler` and `DeliveryVerifier` (backend/src/modules/push/push-transport.ts) in-process: keep the
   sealed body in `PushReminder` (add a column), and run a timer every minute that sends the rows that are due and
   deletes them. Nothing else in `PushService` needs to change; `push.e2e-spec.ts` already runs with fakes of these
   two interfaces.
2. If the database is still free Neon, a per-minute timer keeps it awake and uses up the free compute: either move
   the database next to the API, or keep the timer in memory (load the next hour of reminders once an hour).
3. Replace the Vercel cron with an in-process daily job (`@nestjs/schedule` is already a dependency).
4. Remove `QSTASH_TOKEN`, `QSTASH_URL`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, `CRON_SECRET` from the
   three env places (AGENTS.md § Environment variables), the `crons` entry, and the `@upstash/qstash` dependency.
   Cancel what is still scheduled in the Upstash console after the switch.
5. **Keep the same `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`.** New keys would silently stop reminders on every browser
   until each user turns them on again.

## 2. Preview deployments write to the production database

The Vercel Preview environment uses the production `DATABASE_URL`, and every Preview build runs
`prisma migrate deploy`: a branch's migration reaches production before it is merged (this happened on 2026-10-28
with `20261028120000_add_user_practice_store`). Give previews their own database (a Neon branch, or a staging DB on
the new server).

## 3. Leftover table from that preview (done)

`UserPracticeStore` (empty, unused, from the migration above, which is no longer in the repository) was dropped from
production on 2026-10-28 with the owner's approval, together with its `_prisma_migrations` row, in one transaction
that refused to run if the table held any row. The backup (structure, 0 rows, the history row and the original
`CREATE TABLE` script) was handed to the owner. Nothing to do here when moving.

## 4. Other Vercel-only pieces

- The API is bundled with esbuild and served by `backend/api/index.mjs` (docs/deploy/VERCEL.md § Why the API is
  bundled). On a server, run `node dist/bundle/main.mjs` (what `pnpm --filter backend start:prod` does).
- `regions: ["fra1"]` keeps the function next to Neon (Frankfurt). Pick a server location near the database.
- Public responses rely on a CDN honouring `s-maxage` (backend/src/common/http/public-cache.ts). Put a cache or CDN
  in front, or accept uncached reads.
- Set `TRUST_PROXY` to the number of proxy hops so rate limiting sees real client IPs.
