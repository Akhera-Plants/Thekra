# Theme chip audit

Scope: `backend/prisma/taxonomy/topic-themes.yaml` (325 themes, 112 topics) against `taxonomy.yaml`
(41 `pairs:`; 40 of them have themes, the pair `idaat-al-waqt` / `ightinam-waqt` has none). Checked on
2026-10-23 with the label rules `normTheme(ar)` (tashkeel, hamza seats, ta marbuta folded) and
case-folded `en`, plus word-set similarity ≥ 0.7 on the Arabic label. Counts are from the local
`thekra` database through the API (`?lang=…&limit=10`), before and after the change.

## Result

| Check | Found |
| --- | --- |
| Same Arabic label on the sin side and the deed side of a pair | **1** (`ghadab` / `kaff-al-ghadab`) |
| Same Arabic label twice inside ONE topic | 0 |
| Same English label twice inside one topic or one pair (different Arabic) | 0 |
| Near-duplicate Arabic labels on one page (word-set similarity ≥ 0.7) | 0 |
| Same Arabic label, different English (anywhere in the file) | **1** (`kasb-iffa` / `masala-istifaf`) |

## Fixed by the merge: `ghadab` ↔ `kaff-al-ghadab`

Label «من يملك نفسه عند الغضب» / "Controlling oneself when angry", on both sides.

| Page | Before | After |
| --- | --- | --- |
| `/sins/ghadab` | `ghadab-milk` 4, `kaff-milk` 6 (two identical chips) | one chip `ghadab-milk` **7** |
| `/good-deeds/kaff-al-ghadab` | `kaff-milk` 6, `ghadab-milk` 4 (two identical chips) | one chip `ghadab-milk` **7** |
| `?theme=ghadab-milk` | 4 texts | 7 texts (`meta.total` 7) |
| `?theme=kaff-milk` | 6 texts | 7 texts, `meta.theme` = `ghadab-milk` |

Why 7 and not 10: the two keys share 3 texts (SQL over both link tables: 4 + 6, union 7, in both 3), and a
text under both keys counts once. The other chips on the page (`ghadab-hadhar` 6, `kaff-adha` 4) are
unchanged. The merged chip is keyed by the sin-side key; both old keys still work in `?theme=`.

## Fixed in the yaml: conflicting English

| Arabic | Topics (not a pair) | Keys | Before | After |
| --- | --- | --- | --- | --- |
| الاستعفاف عن المسألة | `kasb-halal`, `masala` | `kasb-iffa`, `masala-istifaf` | "Refraining from begging" / "Refraining from asking" | both "Refraining from begging" |

`masala` is called "Begging without need" in `taxonomy.yaml`, and the deed side already said "begging".
Only `en` changed (`match` is untouched), so no link changes: `pnpm import:taxonomy` ran twice on the local DB,
both times `updated=0` (themes `updated=0 tagged=9642/18104`).

## For the owner (not changed)

Different labels whose links overlap almost completely. They are not duplicates by label, so nothing was
merged; say if one should go.

| Keys | Topics | Shared texts | Sizes |
| --- | --- | --- | --- |
| `jar-iman` / `lisan-khayr` | `haqq-jar` / `hifz-al-lisan` | 4 | 4 and 4 (Jaccard 1.00) |
| `samaha-sidq` / `sidq-bay` | `samaha` / `sidq` | 13 | 13 and 14 (0.93) |

## Unchanged control: `ghibah` ↔ `hifz-al-lisan`

No shared label, so the page is byte-identical before and after: `ghibah-tahrim` 33, `ghibah-mubah` 2,
`ghibah-samaa` 3, `lisan-samt` 29, `lisan-ghibah` 17, `lisan-khayr` 4.

## Rule going forward

`mergePageThemes` (`backend/src/modules/taxonomy/theme-reading.ts`) merges a sin-side and a deed-side theme of a
pair whose folded Arabic label is equal. It never merges two themes of one topic: that is a yaml mistake to fix in
the file.
