# Thekra Mobile — planned, not yet scaffolded

This folder is a **placeholder reserved for a later phase**. There is deliberately no code, no
`package.json`, and no `node_modules` here yet: in phase 1 the mobile app exists only as this plan.

## Planned stack

- **React Native** with **Expo** (managed workflow) and **TypeScript**
- **Expo Router** for navigation
- The same data-fetching approach as the web app (React Query over an Axios client)
- Full **RTL / Arabic-first** layout support, since the primary content is Arabic

The app will be scaffolded with the official Expo template when this phase begins — nothing in this folder
should be hand-rolled before that.

## Relationship to the rest of the monorepo

The mobile app will **consume exactly the same backend API** as the web frontend (`backend/`, NestJS +
Prisma + PostgreSQL). It introduces no separate database, no separate content pipeline, and no mobile-only
business rules: sins, good deeds, quotes, translations, and favorites all come from the same endpoints. Only
presentation and device concerns (offline caching, notifications, haptics) are mobile-specific.

Once scaffolded, `mobile` will be added to `pnpm-workspace.yaml` so it shares the root pnpm workspace.

## Planned initial screens

1. **Home** — the two primary entry points, phrased as moments rather than menus, plus quick access to saved
   content.
2. **"I'm about to sin"** — pick a sin category, then read the reminders that discourage it (Quran verses,
   Hadith, scholarly words), ordered by relevance.
3. **"I want a good deed"** — pick a deed, then read the content that motivates it and describes its reward.
4. **Favorites** — quotes the user saved, available for re-reading.
5. **Settings** — Arabic/English language toggle (with RTL switching), translation preferences, and
   notification preferences.

## Out of scope for now

No authentication flow, no offline sync strategy, and no push-notification infrastructure are decided yet;
they will be specified when this phase is actually started.
