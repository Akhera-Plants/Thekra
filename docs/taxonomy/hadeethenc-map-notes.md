# HadeethEnc → Thekra Taxonomy Map — Notes

Generated from `hadeethenc-unlinked.tsv` (1,454 rows) classified against `taxonomy.yaml`.

---

## Validation output

```
✓ Row count = 1454
✓ IDs match input exactly
✓ All slugs are valid and allowed (no contemporary, no hidden)
✓ All confidence values are 'high' or 'low'
```

---

## Counts

| Category | Count |
|----------|------:|
| Assigned **high** confidence | 175 |
| Assigned **low** confidence | 55 |
| Empty (unassigned) | 1224 |
| **Total** | **1454** |

Only **high** rows will be published; **low** rows go to later human review.

---

## Why so many empty rows?

The input set is weighted towards fiqh, creed, and sira categories that do not map to ethical topics:

| HadeethEnc category | Rows | Main content |
|---------------------|-----:|--------------|
| الفقه وأصوله | 831 | Fiqh procedure: purification, prayer details, fasting rulings, marriage/divorce, transactions — leaves no ethical topic |
| العقيدة | 233 | Creed details, divine attributes, Companions' virtues, fitan/prophecies, Hereafter scenes |
| الفضائل والآداب | 211 | Virtues & etiquette — richest source; most assignments come from here |
| القرآن الكريم وعلومه | 87 | Quranic sciences, tafsir context, asbab al-nuzul |
| السيرة والتاريخ | 57 | Sira and history — excluded per rules |
| الدعوة والحسبة | 28 | Calling to good, obedience to rulers |
| الحديث وعلومه | 7 | Hadith methodology |

The precision-over-recall rule means many borderline or multi-subject hadith are correctly left empty rather than forced into a topic.

---

## Top 30 topics by hadith count

| Rank | Slug | Count | Side |
|------|------|------:|------|
| 1 | `dhikr-akhira` | 42 | DO |
| 2 | `dua` | 19 | DO |
| 3 | `dhikr` | 9 | DO |
| 4 | `khamr` | 9 | AVOID |
| 5 | `nawafil` | 9 | DO |
| 6 | `taat-wulat` | 8 | DO |
| 7 | `husn-khuluq` | 7 | DO |
| 8 | `jumua` | 6 | DO |
| 9 | `quran` | 5 | DO |
| 10 | `hilf-bighayr-allah` | 5 | AVOID |
| 11 | `sadaqah` | 5 | DO |
| 12 | `tawhid` | 4 | DO |
| 13 | `salat-fi-jamaah` | 4 | DO |
| 14 | `shirk` | 3 | AVOID |
| 15 | `riya` | 3 | AVOID |
| 16 | `tatayyur` | 3 | AVOID |
| 17 | `tawakkul` | 3 | DO |
| 18 | `sihr-kahana` | 3 | AVOID |
| 19 | `zulm` | 3 | AVOID |
| 20 | `amana-wafa` | 3 | DO |
| 21 | `kibr` | 3 | AVOID |
| 22 | `adab-majlis` | 3 | DO |
| 23 | `adab-libas` | 3 | DO |
| 24 | `adab-safar` | 3 | DO |
| 25 | `kitman-ilm` | 3 | AVOID |
| 26 | `adab-taam` | 3 | DO |
| 27 | `zuhd` | 3 | DO |
| 28 | `kadhib` | 2 | AVOID |
| 29 | `nashr-ilm` | 2 | DO |
| 30 | `muraqaba` | 2 | DO |

**Note:** `dhikr-akhira` (42) is elevated because many creed-category hadith about Jannah, Nar, and Qiyama scenes fit naturally under "remembering the Hereafter." All are assigned **low** confidence for human review, not high.

---

## 30 random high-confidence examples (spot-check)

| ID | Title (Arabic) | Topics |
|----|----------------|--------|
| 3333 | ألا أخبركم بما هو أخوف عليكم عندي من المسيح الدجال؟ … الشرك الخفي، يقوم الرجل فيصلي فيزين صلاته | `riya` |
| 3334 | قول الله: فَلا تَجْعَلُوا لِلَّهِ أَنْدَادًا وَأَنْتُمْ تَعْلَمُونَ | `shirk` |
| 3408 | لا يحل السحر إلا ساحر | `sihr-kahana` |
| 3410 | أي عم، قل: لا إله إلا الله، كلمة أحاج لك بها عند الله | `tawhid` |
| 3415 | من ذا الذي يتألى عليَّ أن لا أغفر لفلان؟ إني قد غفرت له، وأحبطت عملك | `tawba` |
| 3710 | خير الناس من طال عمره وحسن عمله | `ightinam-waqt` |
| 4526 | أنهى النبي ﷺ عن صوم يوم الجمعة | `jumua` |
| 4711 | لا ضرر ولا ضرار، من ضار ضره الله، ومن شاق شق الله عليه | `zulm` |
| 5335 | ما من عبد يسترعيه الله رعية، يموت يوم يموت وهو غاش لرعيته، إلا حرم الله عليه الجنة | `zulm-raiyya` |
| 5489 | اللهم إني أعوذ بك من غلبة الدين، وغلبة العدو، وشماتة الأعداء | `dua` |
| 5886 | كان رسول الله ﷺ يستحب الجوامع من الدعاء | `dua` |
| 6072 | اللهم إني أعوذ بك من فتنة النار، وعذاب النار، ومن شر الغنى والفقر | `dua` |
| 6326 | إن الله محسن يحب الإحسان إلى كل شيء، فإذا قتلتم فأحسنوا القتلة | `husn-khuluq` |
| 6820 | نضر الله امرأ سمع منا شيئا فبلغه كما سمع | `nashr-ilm` |
| 8283 | إن الرحم شجنة آخذة بحجزة الرحمن، يصل من وصلها، ويقطع من قطعها | `silat-ar-rahim` |
| 8291 | فيبقى كل من كان يسجد في الدنيا رياء وسمعة، فيذهب ليسجد، فيعود ظهره طبقا | `riya` |
| 8369 | سئل رسول الله ﷺ عن الخمر تتخذ خلًّا؟ قال: لا | `khamr` |
| 10847 | زينوا القرآن بأصواتكم | `quran` |
| 10849 | ومن كذب علي متعمدًا فليتبوأ مقعده من النار | `kadhib` |
| 58090 | ملعون من أتى امرأته في دبرها | `liwat` |
| 58121 | البركة تنزل وسط الطعام، فكلوا من حافتيه، ولا تأكلوا من وسطه | `adab-taam` |
| 64688 | من ولاه الله شيئًا من أمر المسلمين فاحتجب دون حاجتهم وفقرهم، احتجب الله عنه | `zulm-raiyya` |
| 64698 | لا يحلف أحد عند منبري هذا على يمين آثمة، ولو على سواك أخضر، إلا تبوأ مقعده من النار | `yamin-ghamus` |
| 65211 | نضر الله امرأ سمع منا حديثا فحفظه حتى يبلغه | `nashr-ilm` |
| 65748 | ألا رجل يتصدق على هذا فيصلي معه | `sadaqah` |
| 65758 | إن الأذان يوم الجمعة كان أوله حين يجلس الإمام على المنبر | `jumua` |
| 65918 | سيكون في هذه الأمة قوم يعتدون في الطهور والدعاء | `dua` |
| 66041 | لعنت الخمر على عشرة وجوه | `khamr` |
| 66097 | إذا استأذن أحدكم ثلاثا فلم يؤذن له فليرجع | `adab-majlis` |
| 66179 | تهادوا تحابوا | `husn-khuluq` |

---

## Classification methodology

**Script:** [`docs/taxonomy/classify_hadeethenc.py`](docs/taxonomy/classify_hadeethenc.py)  
**Validator:** [`docs/taxonomy/validate_hadeethenc_map.py`](docs/taxonomy/validate_hadeethenc_map.py)

### Category-level decisions

- **القرآن الكريم وعلومه (87 rows):** Largely tafsir / asbab al-nuzul context. Only explicit tilawa-encouragement → `quran`; hadith about argumentation in Quran → `jidal`; one dhikr hadith → `dhikr`; shahadah context → `tawhid`.
- **الحديث وعلومه (7 rows):** Methodology only. "كذب علي" → `kadhib`; "نضر الله امرأ" → `nashr-ilm`.
- **السيرة والتاريخ (57 rows):** All empty except two `husn-khuluq` hadith about the Prophet's character being the Quran.
- **العقيدة (233 rows):** Granular matching: shirk/tawhid, tatayyur, sihr/kahana, hilf bighayr Allah, bida, riya. Jannah/Nar scenes → `dhikr-akhira` (low). Fitan/prophecies/Companions' virtues → empty.
- **الفقه وأصوله (831 rows):** Procedural fiqh → empty. Clear moral violations (`khamr`, `zina`, `riba`, `sariqa`, `rishwa`) → assigned.
- **الفضائل والآداب (211 rows):** Richest source. Pattern-matched across all virtue/vice slugs.
- **الدعوة والحسبة (28 rows):** Obedience to rulers → `taat-wulat`; enjoining good → `amr-maruf`; betrayal by rulers → `zulm-raiyya`.

### Low-confidence items to review (55 rows)

- All `dhikr-akhira` from العقيدة: Hereafter details that are more creed-oriented than ethical reminders
- Hadith with dual interpretations (e.g. fiqh hadith that carries a secondary ethical lesson)
- `khamr,qat-al-rahim` (one hadith listing three sins together)

---

*Generated by rule-based pattern matching on Arabic title and HadeethEnc sub-category codes. No network calls. All assignments are based on main subject, not passing mention.*
