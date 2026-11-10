# «تخفَّف» always encrypted and in the account: what the clients do

> Owner decision, 2026-11-01 (docs/plan/2026-11-01-owner-round-3.md): «تخفَّف» data (programs, check-ins, notes, «حلقة
> المعصية») is always kept in the member's account, encrypted so that the server cannot read it, and unlocked on the
> device (fingerprint / face on the app). There is no "on this device only" mode, and no screen says «على جهازك فقط».
>
> **Superseded in part by owner round 7 (2026-11-10, C6):** the privacy code is now OPTIONAL when a program starts
> («تخطَّ وابدأ»). Without a code the program stays on this device only — it is never sent unencrypted (the practice sync
> refuses programs and nothing is sealed without a key), it shows uncovered like any habit, it is not wiped on sign-out,
> and one short line says «بلا رمز يبقى البرنامج على هذا الجهاز فقط». The code can be set later inside the program
> («⋯ › الخصوصية والإخفاء», or «أخفِه برمز» under its name), which seals it into the account as in §1 and covers it;
> with a code, the same place holds the covering switch. §6 «never offer a device-only mode» no longer applies.

The server and the crypto are unchanged: `GET|PUT|DELETE /v1/me/sin-vault` (contract
[2026-10-practice-sync-contract.md](2026-10-practice-sync-contract.md) §3 «Sin vault») and practice-core `vault.ts`. The
server stores one opaque blob per account and checks only its shape. What changes is the clients' flow.

## 1. The first program creates the vault

When a member starts their first «تخفَّف» program and the account has no vault (`GET` returns `vault: null`):

1. Ask for a «رمز الخصوصية» before the program starts. Say plainly: the code locks this data so that nobody, not even
   the app's team, can read it; a forgotten code cannot be recovered (the data is then lost, and a new start is
   possible). Check it with `privacyCodeProblem(code)` (at least 8 characters, not an easy pattern).
2. `const { payload, key, salt, iterations } = createVault(code, [program])` (600,000 PBKDF2 iterations, a fresh salt,
   `version: 0`), then `PUT /v1/me/sin-vault` with `payload`. Keep `version` from the response.
3. Keep the key unlocked (§2). Do not keep the code itself anywhere.

If `GET` returns a vault (another device made it), never create a new one: unlock it (§3).

## 2. Keeping it unlocked

- **App:** after the code is entered once, store `serializeVaultKey(key, { salt, iterations })` in the keystore with
  biometric protection (`expo-secure-store`, `requireAuthentication: true`). Opening «تخفَّف» later asks for the
  fingerprint / face only; `parseVaultKey(text)` gives `{ key, salt, iterations }`. When biometrics are not available or
  the keystore entry is gone (new phone, biometrics changed), ask for the code again (§3). The key never leaves the
  keystore and is never sent.
- **Web:** keep the key in memory for the session only (the tab). After a reload the code is asked again. Do not store
  the key in `localStorage`, IndexedDB or cookies.
- The extension has no «تخفَّف».

## 3. Opening on a device

`GET /v1/me/sin-vault`, then either the kept key (`openPrograms(vault, kept.key)`, after checking `vault.salt` and
`vault.iterations` equal the kept ones; if not, the code was changed on another device: ask for it) or the code
(`unlockVault(vault, code)` → `{ programs, key }`). A wrong code throws `VaultLockedError`: say «الرمز غير صحيح» and let
the member try again. Merge with the local copy: `mergePrograms(local, opened)`.

## 4. Autosave on every change

Every change to a program (start, check-in, details, note, «حلقة المعصية», end) is saved to the account, not only on
the device:

1. Update the local store at once (the screen never waits for the network).
2. Debounce about 2 s, then `PUT` `sealVault(programs, kept, version)`; on success store the new `version`.
3. On `409 SIN_VAULT_CONFLICT` (another device saved first): open `details.vault` with the kept key, `mergePrograms`
   (local, theirs), seal with the returned version and `PUT` again.
4. Offline or a server error: keep a "pending" flag and retry on focus, on reconnect and with the practice sync. The
   local copy stays the member's working copy meanwhile.
5. Read the vault again on sign-in and on app focus (like the practice sync), merge, and save when the merge changed
   anything.

The ciphertext limit is 128 KB; with at most 3 programs, their notes and up to 5 loops each it is far below that.
`sealPrograms` throws a `VaultError` past the limit: show a short message, keep the local copy.

## 5. Changing or forgetting the code

- **Change:** ask for the current code (or use the kept key), then a new code: `createVault(newCode, programs)` gives a
  new salt and key; `PUT` it with the current `version` instead of 0 (`vaultPayload(sealPrograms(programs, key), {
  salt, iterations, version })`), and replace the kept key record.
- **Forgot:** the data cannot be opened. Offer «ابدأ من جديد»: `DELETE /v1/me/sin-vault`, clear the local programs and
  the kept key, and start again at §1.
- **Sign out:** clear the kept key and the local programs from the device (the account keeps the vault).

## 6. Never

- Never send a program, slug, note or loop in clear: not in the practice sync (the server refuses any `programs` key),
  not in analytics, logs, crash reports, push payloads, notification or calendar titles.
- Never log the code, the key or the decrypted JSON.
- Never offer a device-only mode, and never write «على جهازك فقط».
