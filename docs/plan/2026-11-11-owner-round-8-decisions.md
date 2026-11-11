# Owner round 8 — decisions (2026-11-11)

Source: the owner's choices on the review page «تدقيق رحلات ذكرى» (artifact CzvUBvQhPP7ookisPX8LPj, `decisions/q-*`) and his
messages of 2026-11-11. Nothing below is built yet; the owner asked for a deep screen-by-screen critique FIRST and a
yes/no from him before any change (see §3).

## 1. Requests built (committed 628cf85)
- «الدليل» → «المعينات» (web, app). Weekly and evening reviews became real forms (fields for what helped / what was hard /
  what to change, a step per hard habit, heart + note, message to self).

## 2. Answers to the 13 open questions
| # | Question | Chosen |
|---|---|---|
| Q1 | «تخفّف» without a privacy code: stored readable? | **Always encrypted** with a device-generated local key; wiped on sign-out |
| Q2 | صحبة pages on the web? | **App only**, with an honest dialog and store links |
| Q3 | Custom habit | **One free habit** with title, amount and unit (counts within the 3-habit limit) |
| Q4 | Account recovery | **Reset link by email** (keep the «تخفّف» code separate from the password so a reset never destroys the vault) |
| Q5 | «اقضِ ما فاتك» | Ask **«هل فعلتها؟»** before logging yesterday |
| Q6 | صحبة invite type | **Personal invite tied to the صحبة** (7 days, single use) |
| Q7 | Where the owner reviews صحبة reports | **A page in the admin dashboard** |
| Q8 | Door name | **«تخفَّف من ذنب»** (write it in GLOSSARY) |
| Q9 | Periodic acts limit | **8** (update the docs) |
| Q10 | صحبة notifications | **On for direct lines only** (not for the whole circle) |
| Q11 | Round label | **Free text with a content filter**. Owner note: add a curated list of partly/fully inappropriate words that get covered when a message is sent; research the best tools/lists online for this (recommend, do not build yet) |
| Q12 | Refresh-token revocation (sign out of all devices) | **After moving off Vercel** (remind him: docs/deploy/MIGRATION_OFF_VERCEL.md) |
| Q13 | Desktop columns in «اليوم» | **Two columns** as decided |

The 12 packages were not answered (the owner said he did not understand the ones he did not comment on).

## 3. New instruction (round 8b)
The owner called the first audit shallow. He wants a DEEP, harsh, screen-by-screen and flow-by-flow critique of the whole
product (web and app) using the design skills, judged against the real users (a person leaving THEIR OWN sin(s), habit
builders, readers, صحبة members, low-vision users), BEFORE any edit, so he can answer yes/no. Specific complaints:
- «لحظة مجاهدة» (icon, what it does, everything inside) is disorganised and bad; it must serve the sin THE USER chose, not
  assume one (he thought I had assumed غض البصر).
- Elements that look clickable but do nothing (dead taps) are unacceptable.
- No crowded UI: ideal, uncluttered screens.
- He mentioned an image of real-user suggestions for people leaving a sin; it did not arrive: ask him to resend it.

## 4. Built: صحبة invites and the web dialog (agent B4, not committed)
Decisions Q2 and Q6 are in. No new environment variable and no schema change (no migration).
- **One entry for an invitation.** The صحبة list has «أنشئ صحبة» and «لديّ دعوة» (`mobile/app/circles/redeem.tsx`); a
  person whose صحبة is off sees the same form as the page itself. The three old gates (activation code, `/circles/join`,
  «دعواتي») are gone. Owners invite with «ادعُ» on the circle's page (`InviteSheet.tsx`): one share action sends an https
  link (`https://thekra-web.vercel.app/invite/<code>`, `/en/invite/<code>` in English) and the code to type.
- **The link.** `frontend/src/app/[locale]/invite/[code]/page.tsx` explains the invite, shows the code, and «افتح في
  التطبيق» opens `thekra://circles/invite/<code>`. It never looks the code up (nothing about a circle leaks to a link
  holder) and is not indexed. Real universal/app links (the https link opening the app by itself) need two files the
  owner must supply: Apple's `apple-app-site-association` (team ID) and Android's `assetlinks.json` (signing SHA-256),
  plus `associatedDomains` / `intentFilters` in `mobile/app.config.ts`. Until then the button is the bridge.
- **Redeem** (`POST /v1/circles/invites/redeem`): a circle invite joins in ONE step, also for an account that has not
  turned صحبة on; the name shown is the account's own name unless the request sends one (an account without a name is
  asked, 400 `CIRCLE_DISPLAY_NAME_REQUIRED`). Refusals: 404 `CIRCLE_INVITE_INVALID` (a code nobody issued), 410
  `CIRCLE_INVITE_EXPIRED` / `CIRCLE_INVITE_USED` / `CIRCLE_INVITE_REVOKED`, 409 `CIRCLE_FULL` /
  `CIRCLE_LIMIT_REACHED` / `CIRCLE_INVITE_CIRCLE_GONE`. A 409 rolls the whole redemption back: the invite stays unused and
  صحبة stays off. Creating an invite for a full circle is 409 `CIRCLE_FULL`. `joinError` is gone from the result.
- **The permanent circle code is removed from the API and the app**, not just hidden: `POST /v1/circles/join`,
  `POST /v1/circles/:id/invite-code` and `CircleDetail.inviteCode` no longer exist. Existing members are unaffected
  (membership is a row, not a code). The `Circle.inviteCode` column stays (NOT NULL, unique, still filled on create): drop
  it in a later cleanup migration. An empty circle left by a deleted account is now swept when the next circle is created.
- **Web «صحبة (في التطبيق)» dialog** says what صحبة is now (a private group by personal invitation, rounds, short
  encouraging messages) and has a close button. **No store address exists anywhere in the repo**, so none is shown and
  none was invented: `frontend/src/lib/app-stores.ts` holds `APP_STORE_URL` and `PLAY_STORE_URL` (both `null`); fill them
  the day the app is published and the buttons appear in the dialog and on the invite page. Until then both say plainly
  that the app is not in the stores yet.
- **Small circle-screen fixes.** One entry per round in the feed (the «end» line is dropped when its start line is shown);
  no empty «استُعملت» header; the whole member row in the circle's settings opens the member menu; message bubbles end
  with «⋯»; the presence grid has no filled pill or badge that looks like a button (today is a tinted column).
- **Not built (owner decision pending or out of scope):** the circle page redesign, notifications for direct lines (Q10),
  the round-label filter (Q11, recommendation only), an optional label on an invite («لمن هذه الدعوة؟», would need an
  additive migration).
