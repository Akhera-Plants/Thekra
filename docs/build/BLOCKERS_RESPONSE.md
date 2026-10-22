# Owner Response to BLOCKERS.md

> Reply to `docs/build/BLOCKERS.md` (Phase 7 scaffold). Checked against the code at `c3a466c`.

## Summary

| ID | Verdict | Who |
| --- | --- | --- |
| B-01 EAS credentials | **Real blocker.** Owner action. Cursor prepares everything else. | Owner + Cursor |
| B-02 OTA updates | **Partly wrong.** Only the EAS channels need an account; the rest is code. | Cursor now, channels later |
| B-03 Mobile refresh token | **Not a blocker. The claim is wrong.** | Cursor: verify + close |
| B-04 Arabic font | **Not a blocker.** Phase 7 scope, and the font is free (OFL). | Cursor now |

---

## B-01 · EAS Build credentials — keep as BLOCKED (owner)

Owner will do steps 1–5 (Apple Developer, App Store Connect, Google Play, `eas credentials`). No date yet.

**Cursor: do now (no account needed)**
1. Add `mobile/eas.json` with `development`, `preview` (internal distribution) and `production` profiles, and
   `channel` set per profile (`development`, `staging`, `production`).
2. Write `.github/workflows/mobile-release.yml` per devops-plan §3.3. It needs `EXPO_TOKEN` and runs only when
   the secret exists (`if: ${{ secrets.EXPO_TOKEN != '' }}` at job level via an env check), so CI stays green.
3. Keep bundle id / package `com.thekra.app`.
4. Write `mobile/RELEASE.md`: the exact owner steps, in order, with the commands.
5. Change B-01 in BLOCKERS.md to "waiting on owner accounts — everything else ready".

## B-02 · expo-updates — split it

The claim "blocked until B-01" is only true for creating channels on EAS.

**Cursor: do now**
1. `pnpm --filter mobile exec npx expo install expo-updates`.
2. Set `"runtimeVersion": { "policy": "appVersion" }` in `app.json`, and add `updates.url` as an env-driven
   placeholder (`app.config.ts` reading `EAS_PROJECT_ID`). The app must still build and run in Expo Go /
   dev builds when it's unset.
3. Wire the `channel` per build profile in `eas.json` (done in B-01 step 1).
4. Gates: mobile lint, `tsc --noEmit`, tests.
5. Change B-02 in BLOCKERS.md to "only `eas update:configure` + channel creation left, after B-01".

## B-03 · Mobile refresh token — REJECT, close it

The blocker is wrong. Verified in the code:
- `backend/src/modules/auth/auth.service.ts:173` returns `{ accessToken, refreshToken, expiresIn }` in the
  **response body** for register, login and refresh.
- `backend/src/modules/auth/auth.controller.ts:47-52`: `POST /v1/auth/refresh` already takes
  `{ refreshToken }` in the **body** (`RefreshTokenDto`).
- The httpOnly cookie is set by the **Next.js route handler** in the frontend, not by the backend
  (backend-plan §7.1 "Transport"). The backend has no cookie path.
- `mobile/src/lib/stores/auth-store.ts:67,83` already saves `tokens.refreshToken` to SecureStore.

**Cursor: do now**
1. Add a backend e2e test that proves the mobile flow: login → body has `refreshToken` → `POST /v1/auth/refresh`
   with `{ refreshToken }` → 200, new pair, rotated refresh token. (Skip if an existing auth e2e already
   asserts exactly this; then point to it.)
2. Add a mobile unit test for `performRefresh()`: stored token sent in the body, new tokens saved, a failure
   clears the token, concurrent 401s share one request.
3. Remove B-03 from BLOCKERS.md and log the correction in DECISIONS.md ("B-03 was a false blocker:
   the cookie lives in the Next.js route handler, not the API").

## B-04 · Arabic font — do it now (Phase 7 scope, not Phase 8)

mobile-plan / roadmap Phase 7 lists "`expo-font` with the Arabic family". Phase 8 only swaps in the **final
brand** font. A placeholder Arabic font is needed now so tashkeel renders the same on iOS and Android during QA.

**Cursor: do now**
1. Add **Noto Naskh Arabic** (SIL OFL 1.1, from Google Fonts / the official noto-fonts repo) to
   `mobile/assets/fonts/`, with its `OFL.txt` license file next to it.
2. Load it with `expo-font` in the root layout before the first render (keep the splash screen up until it loads).
3. Point the mobile tokens' Arabic family at it, behind one token name, so Phase 8 is a one-line swap.
4. Use the same font for the web Arabic `next/font` slot if the web still uses a system fallback. Log it in
   DECISIONS.md either way.
5. Remove B-04 from BLOCKERS.md and add one line to the Phase 8 list: "replace placeholder Noto Naskh Arabic
   with the final brand font".

---

## Prompt for Cursor (repo root)

```
Read docs/build/BLOCKERS_RESPONSE.md and apply it. The owner has decided, so don't ask:
- B-01: prepare eas.json, mobile-release.yml (skips without EXPO_TOKEN) and mobile/RELEASE.md. Keep B-01
  open for owner accounts only.
- B-02: install and configure expo-updates now. Only EAS channel creation waits for B-01.
- B-03: false blocker. Add the backend e2e and mobile unit tests that prove the body-based refresh flow,
  then remove B-03 and log the correction in DECISIONS.md.
- B-04: bundle Noto Naskh Arabic (OFL) with expo-font now, behind one font token. Remove B-04.
Run all gates (backend, frontend, mobile) after each item. Commit each item separately. Update PROGRESS.md
and BLOCKERS.md. Report back with the commits and the gate output.
```
