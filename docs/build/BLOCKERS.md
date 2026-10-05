# Thekra — Build Blockers

> Blockers that prevent a production build or store submission.
> Updated from owner reply in `BLOCKERS_RESPONSE.md`.

---

## B-01 · EAS Build credentials — waiting on owner accounts (everything else ready)

**Scope:** Apple Developer, App Store Connect, Google Play, `eas credentials`, `EXPO_TOKEN`.

**Repo status (done):**
- `mobile/eas.json` — `development` / `preview` (internal) / `production` profiles with channels
  `development`, `staging`, `production`; bundle id `com.thekra.app`.
- `.github/workflows/mobile-release.yml` — skips when `EXPO_TOKEN` is unset.
- `mobile/RELEASE.md` — ordered owner steps and commands.

**Owner still needs to:**
1. Apple Developer Program membership (~$99/year).
2. App Store Connect entry for "Thekra" (`com.thekra.app`); set `ascAppId` in `eas.json`.
3. `eas credentials --platform ios`.
4. Google Play Console account + app (`com.thekra.app`).
5. `eas credentials --platform android`.
6. Set GitHub secrets `EXPO_TOKEN` and `EAS_PROJECT_ID`.

**Impact while blocked:** Expo Go / local `expo start` work. TestFlight / Play internal track
and CI EAS builds wait on the accounts above.

---

## B-02 · expo-updates — only `eas update:configure` + channel creation left (after B-01)

**Scope:** Create EAS Update channels on the Expo project.

**Repo status (done):**
- `expo-updates` installed (SDK-aligned).
- `mobile/app.config.ts` — `runtimeVersion.policy = appVersion`; `updates.url` only when
  `EAS_PROJECT_ID` is set (disabled otherwise so Expo Go / dev builds still run).
- Channels named in `eas.json` (`development`, `staging`, `production`).

**Owner still needs to (after B-01):**
1. `eas update:configure`
2. Ensure channels exist (`eas channel:create …` if not auto-created by first build)

See `mobile/RELEASE.md` §4.

---

*Closed in this pass: B-03 (false blocker), B-04 (Noto Naskh Arabic placeholder bundled).*

*Last updated: owner BLOCKERS_RESPONSE — October 2026.*
