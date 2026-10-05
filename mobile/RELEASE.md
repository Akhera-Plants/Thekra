# Thekra mobile — owner release checklist

Bundle ID / package: `com.thekra.app`  
Channels (from `eas.json`): `development`, `staging` (preview), `production`

Everything below needs **your** Apple / Google / Expo accounts. Repo prep
(`eas.json`, `app.config.ts`, `mobile-release.yml`, `expo-updates`) is already done.

---

## 1. Expo / EAS project

```bash
# From repo root (once)
pnpm --filter mobile exec npx eas-cli login
pnpm --filter mobile exec npx eas init   # creates the EAS project; note the project ID
```

Add GitHub Actions secrets (repo → Settings → Secrets):

| Secret | Value |
| --- | --- |
| `EXPO_TOKEN` | Expo access token (`https://expo.dev/settings/access-tokens`) |
| `EAS_PROJECT_ID` | UUID from `eas init` / project settings |

Optional local env for `app.config.ts` updates URL:

```bash
# mobile/.env (gitignored) or shell
export EAS_PROJECT_ID=<uuid>
```

---

## 2. Apple Developer + App Store Connect

1. Enrol in the [Apple Developer Program](https://developer.apple.com/programs/) (~$99/year).
2. In App Store Connect, create app **Thekra** with bundle ID `com.thekra.app`.
3. Note the numeric **Apple ID** (App Store Connect → App Information) and put it in
   `mobile/eas.json` → `submit.production.ios.ascAppId` (replace the placeholder).

```bash
cd mobile
pnpm exec eas credentials --platform ios
# Follow prompts: let EAS manage distribution cert + provisioning profile
```

---

## 3. Google Play

1. Create a [Google Play Console](https://play.google.com/console) account (~$25 one-time).
2. Create app **Thekra** with package `com.thekra.app`.
3. Generate/upload the Android keystore via EAS:

```bash
cd mobile
pnpm exec eas credentials --platform android
```

---

## 4. EAS Update channels (after B-01 accounts)

```bash
cd mobile
pnpm exec eas update:configure
pnpm exec eas channel:create development   # if not auto-created by first build
pnpm exec eas channel:create staging
pnpm exec eas channel:create production
```

Publish an OTA (JS-only) to staging:

```bash
pnpm exec eas update --channel staging --message "describe the fix"
```

---

## 5. First builds

Local / CI:

```bash
# Internal preview (TestFlight-like / internal track later)
cd mobile && pnpm exec eas build --profile preview --platform all

# Store production binary
pnpm exec eas build --profile production --platform all
pnpm exec eas submit --profile production --platform all
```

Or tag a release so GitHub Actions runs `mobile-release.yml`:

```bash
git tag mobile-v0.1.0
git push origin mobile-v0.1.0
```

Without `EXPO_TOKEN`, that workflow **skips** and exits green.

---

## 6. Verify

- [ ] `eas build --profile preview` finishes for iOS and Android
- [ ] Internal distribution install works on a device
- [ ] `eas update --channel staging` lands in the preview build
- [ ] Production build submitted to App Store Connect + Play Console (draft/internal is fine)
