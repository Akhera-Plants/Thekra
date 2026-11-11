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
