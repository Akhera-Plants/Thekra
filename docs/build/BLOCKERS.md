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

## B-02 · expo-updates OTA channels — only EAS channel creation left (after B-01)

**Scope:** `eas update:configure` + create channels on the EAS project.

**Repo status:** see next commit (install + `runtimeVersion` + env-driven `updates.url`).
Until that lands, treat code wiring as in progress; channel creation still needs B-01.

---

## B-03 · Backend refresh-token mobile support — *(closing — false blocker)*

See DECISIONS.md. Body-based refresh already exists; verification tests closing this.

---

## B-04 · Arabic font bundle — *(closing — Phase 7 scope)*

Placeholder Noto Naskh Arabic (OFL) landing in Phase 7; Phase 8 only swaps the brand font.

---

*Last updated: owner BLOCKERS_RESPONSE — October 2026.*
