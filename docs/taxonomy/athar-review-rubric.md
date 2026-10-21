# Athar review rubric (owner-approved rules)

One decision per row of `docs/taxonomy/athar-review.tsv`. Columns to fill: `decision` (keep | drop),
`correctedText` (only when trimming fixes the row), `correctedAttribution` (SAID | NARRATED, only when wrong).

## keep only if ALL hold
1. It is a saying or a short story of a Companion or a Successor on the approved list, about faith, worship,
   character, the heart, the Hereafter or conduct — useful as a reminder to an ordinary Muslim today.
2. The text is complete and readable on its own: starts at the speaker frame («قال فلان» / «عن فلان قال»),
   no chain, no missing words («. . .»), no OCR noise, no author's note («هكذا موقوفا»، «وإسناده…»، «رواه…»).
   If one trailing note/chain fragment is the only problem, keep and put the trimmed text in `correctedText`.
3. It is not a prophetic hadith in disguise: no «قال رسول الله»، «عن النبي»، «رفعه»، «نهينا/أمرنا»، and not
   a well-known hadith wording (e.g. «من صام رمضان إيمانا واحتسابا…») → drop.
4. Attribution is right: SAID when the words are the speaker's own; NARRATED when he tells what someone else
   said or did (e.g. Mujahid telling what Ibn Umar did). Fix in `correctedAttribution`.

## drop if ANY holds (owner content rules)
- Calls on or asks help from anyone other than Allah; anything doubtful in creed.
- Israʾiliyyat / stories of past prophets and nations not from the Quran or authentic hadith (Adam's tears for
  300 years, the lion on Noah's ship, Ibrahim's call, Yusuf/Yaqub durations, giants, «في الكتب الأولى» …).
  Luqman's sayings narrated by al-Hasan may stay only if purely moral advice.
- Strange or unhelpful content (tafsir glosses of single words, odd natural claims, numbers of years …).
- Fiqh detail or rulings (better taken from fiqh books), political or sectarian content, harsh content about
  specific people.
- Fragment, mid-dialogue start that is unclear, or empty frame.
- Anything you are unsure about → drop (precision over recall).
