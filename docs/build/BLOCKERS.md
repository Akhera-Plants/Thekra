# Thekra — Build Blockers

> Blockers that prevent a production build or store submission.
> Phase 7 mobile scaffold (October 2026).

---

## B-01 · EAS Build credentials — BLOCKED

**Scope:** EAS Build (iOS + Android), EAS Submit, app store registration.

**Status:** Not configured. No Apple Developer account, no Google Play Console account,
no provisioning profiles, no keystore.

**What is needed to unblock:**
1. Apple Developer Program membership (~$99/year).
2. Create an App Store Connect entry for "Thekra" with the bundle ID `com.thekra.app`.
3. EAS Build: run `eas credentials` to generate/upload iOS provisioning profiles and certificates.
4. Google Play: create an account (~$25 one-time), create the Play Console entry for `com.thekra.app`.
5. Android keystore: run `eas credentials --platform android` to generate/upload.
6. Set `EXPO_TOKEN` in CI (GitHub Actions `mobile-release.yml` — does not exist yet).

**Impact while blocked:** Development builds (Expo Go / `expo start`) work locally.
TestFlight / internal track builds are blocked. The `docs/plan/devops-plan.md` §3.3 covers
the full EAS workflow.

---

## B-02 · expo-updates OTA channels — BLOCKED

**Scope:** Over-the-air (OTA) updates via `expo-updates`.

**Status:** Not configured. `expo-updates` is not installed and no EAS Update project exists.

**What is needed to unblock:**
1. Unblock B-01 first (EAS project must exist).
2. `pnpm --filter mobile exec npx expo install expo-updates`.
3. Configure `runtimeVersion` policy in `app.json`.
4. Create EAS Update channels (`staging`, `production`).

---

## B-03 · Backend refresh-token mobile support — ACTION REQUIRED

**Scope:** Mobile auth token refresh flow (`POST /v1/auth/refresh`).

**Status:** The current backend sets the refresh token as an httpOnly cookie only.
The mobile client cannot read httpOnly cookies from the API response (no browser cookie jar).

**What is needed to unblock:**
1. Backend change (additive, non-breaking): also return `refreshToken` in the
   `POST /v1/auth/login` response body (in addition to the existing httpOnly cookie).
2. Backend change (additive): accept `{ refreshToken }` in the body of
   `POST /v1/auth/refresh` (in addition to the existing cookie-based path).
3. The mobile client (`src/lib/api-client.ts`) already implements the
   SecureStore + request-body pattern; it will work once the backend sends the token.

**Impact while blocked:** Login and registration succeed (token returned), but automatic
token refresh on 401 (single-flight refresh) will fail silently until the backend
change lands. Users will be required to log in again after token expiry.

---

## B-04 · Arabic font bundle — DEFERRED to Phase 8

**Scope:** Bundled Arabic font file for tashkeel rendering consistency.

**Status:** Phase 7 uses the system Arabic font (adequate for development and QA).
The bundled font (e.g. Noto Naskh Arabic) will be added in Phase 8 with the
design system swap-in.

**What is needed to unblock:**
1. Obtain a suitable Arabic font (OFL-licensed, tashkeel-complete).
2. Add font file to `assets/fonts/`.
3. Configure `expo-font` in the root layout to load it before rendering.
4. Update `tokens.ts` to reference the font family name.

---

*Last updated: Phase 7 scaffold — October 2026.*
