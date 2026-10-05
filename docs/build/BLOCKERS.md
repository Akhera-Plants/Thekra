# Thekra — Autonomous Build Blockers

Human actions required. Build continues around these with stubs/fixtures/feature flags.

| ID | Blocked | Workaround built | Exact owner action |
| --- | --- | --- | --- |
| B-001 | P0-4 seed content accuracy | No seed edits applied | Tick verified rows in `docs/reviews/phase-2-backend-review-followup.md` § P0-4, then ask agent to apply only those |
| B-002 | Phase 4b Silat ar-Rahim | Skipped entirely | Approve silat-rahim-plan §4 schema + `ical-generator` + curated forgotten-deeds content |
| B-003 | Git remote | Local commits + CI workflow file only | `git remote add origin <url>` and push so GitHub Actions runs |
| B-004 | Vercel staging / PR previews | Frontend builds locally | Create Vercel project; wire repo; set `NEXT_PUBLIC_API_URL` |
| B-005 | Railway (or similar) API staging | Backend Dockerfile ready | Create Railway/Postgres project; set secrets from `.env.example` |
| B-006 | Quran.com / Sunnah.com API keys | Phase 5 fixtures only; `SYNC_ENABLED=false` default | Put keys in `backend/.env` (never commit); enable sync in staging |
| B-007 | Expo / EAS / App Store / Play | Mobile scaffold local only | Create Expo/EAS account; configure credentials; submit builds |
| B-008 | Phase 8 real palette + fonts | Neutral semantic tokens kept | Provide brand CSS variables + Arabic/Latin font files or URLs |
