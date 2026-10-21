# Ibn Abi al-Dunya chapter map — reviewer notes

File: `backend/prisma/taxonomy/ibn-abi-dunya-map.yaml`. The source exports contain **174** eligible `BAB` rows with `hadith > 0`; **132** chapters are mapped and **42** are deliberately left unmapped. The mapped chapters contain **2,547** unique hadith items and create **145** chapter-topic links.

## Review method

- Mapping is based on the chapter title read with the work subject. A work title alone was not enough when a chapter title was ambiguous.
- Side follows the title: condemnation, prohibition, or warning maps to an AVOID topic; merit, encouragement, or a stated virtue maps to a DO topic. Mixed titles may map to both, with a maximum of two topics.
- Biographies and named-person stories, dreams, voices/hatif, jinn, rain/thunder lore, `MaqtalCali`, `ManCashaBacdaMawt`, bare names, unclear titles, and titles that merely permit an otherwise prohibited act were omitted.
- Contemporary and hidden taxonomy topics were excluded. Counts below treat an item once per topic link; therefore multi-topic chapters contribute their item count to each linked topic.

## Per-work coverage

| work | eligible chapters | mapped chapters | unmapped chapters | mapped hadith items |
|---|---:|---:|---:|---:|
| `Ahwal` | 0 | 0 | 0 | 0 |
| `AmrBiMacruf` | 0 | 0 | 0 | 0 |
| `Awliya` | 0 | 0 | 0 | 0 |
| `CaqlWaFadluh` | 0 | 0 | 0 | 0 |
| `Ciyal` | 34 | 22 | 12 | 501 |
| `CumrWaShayb` | 0 | 0 | 0 | 0 |
| `Cuqubat` | 0 | 0 | 0 | 0 |
| `Cuzla` | 0 | 0 | 0 | 0 |
| `DhammBaghy` | 0 | 0 | 0 | 0 |
| `DhammDunya` | 0 | 0 | 0 | 0 |
| `DhammGhiba` | 10 | 7 | 3 | 109 |
| `DhammMalahi` | 10 | 6 | 4 | 78 |
| `DhammMuskir` | 0 | 0 | 0 | 0 |
| `DhikrMawt` | 0 | 0 | 0 | 0 |
| `FadailRamadan` | 0 | 0 | 0 | 0 |
| `FadlCashrDhiHijja` | 0 | 0 | 0 | 0 |
| `FarajBacdaShidda` | 0 | 0 | 0 | 0 |
| `HammWaHuzn` | 1 | 0 | 1 | 0 |
| `Hawatif` | 0 | 0 | 0 | 0 |
| `Hilm` | 0 | 0 | 0 | 0 |
| `HilmMucawiya` | 0 | 0 | 0 | 0 |
| `HusnZannBiLlah` | 0 | 0 | 0 | 0 |
| `IctibarWaAcqab` | 0 | 0 | 0 | 0 |
| `IkhlasWaNiyya` | 0 | 0 | 0 | 0 |
| `Ikhwan` | 16 | 16 | 0 | 226 |
| `IshrafFiManazil` | 0 | 0 | 0 | 0 |
| `IslahMal` | 0 | 0 | 0 | 0 |
| `IstinacMacruf` | 7 | 6 | 1 | 143 |
| `Juc` | 0 | 0 | 0 | 0 |
| `KalamLayali` | 0 | 0 | 0 | 0 |
| `MakaidShaytan` | 1 | 0 | 1 | 0 |
| `MakarimAkhlaq` | 0 | 0 | 0 | 0 |
| `ManCashaBacdaMawt` | 0 | 0 | 0 | 0 |
| `Manamat` | 0 | 0 | 0 | 0 |
| `MaqtalCali` | 0 | 0 | 0 | 0 |
| `MaradWaKaffarat` | 0 | 0 | 0 | 0 |
| `MatarWaRacd` | 4 | 0 | 4 | 0 |
| `MudaratNas` | 11 | 8 | 3 | 136 |
| `MuhasabatNafs` | 5 | 5 | 0 | 128 |
| `Muhtadarin` | 5 | 2 | 3 | 52 |
| `MujabuDacwa` | 0 | 0 | 0 | 0 |
| `Mutamannin` | 0 | 0 | 0 | 0 |
| `QadaHawaij` | 3 | 3 | 0 | 94 |
| `Qanaca` | 4 | 4 | 0 | 17 |
| `QasrAmal` | 2 | 2 | 0 | 114 |
| `QiraDayf` | 0 | 0 | 0 | 0 |
| `Qubur` | 3 | 2 | 1 | 57 |
| `RasailFiTawakkul` | 0 | 0 | 0 | 0 |
| `Rida` | 0 | 0 | 0 | 0 |
| `RiqqaWaBuka` | 0 | 0 | 0 | 0 |
| `Sabr` | 0 | 0 | 0 | 0 |
| `Samt` | 26 | 19 | 7 | 493 |
| `Shukr` | 0 | 0 | 0 | 0 |
| `SifatJanna` | 19 | 19 | 0 | 270 |
| `SifatNar` | 1 | 1 | 0 | 16 |
| `Tahajjud` | 0 | 0 | 0 | 0 |
| `TawaducWaKhumul` | 0 | 0 | 0 | 0 |
| `Tawakkul` | 0 | 0 | 0 | 0 |
| `Tawba` | 0 | 0 | 0 | 0 |
| `Wajal` | 0 | 0 | 0 | 0 |
| `Warac` | 12 | 10 | 2 | 113 |
| `Yaqin` | 0 | 0 | 0 | 0 |
| `Zuhd` | 0 | 0 | 0 | 0 |

## Per-topic counts

| topic | ar | side | chapters | hadith items |
|---|---|---|---:|---:|
| `adl` | العدل ورد المظالم | DO | 1 | 9 |
| `amana-wafa` | أداء الأمانة والوفاء بالعهد | DO | 2 | 18 |
| `dhikr-akhira` | التشويق إلى الجنة وتذكّر الآخرة | DO | 22 | 343 |
| `dhul-wajhayn` | ذو الوجهين والنفاق في التعامل | AVOID | 2 | 15 |
| `ghibah` | الغيبة | AVOID | 3 | 100 |
| `hajj` | الحج والعمرة | DO | 1 | 14 |
| `haya` | الحياء | DO | 1 | 10 |
| `hifz-al-lisan` | حفظ اللسان والصمت إلا عن خير | DO | 2 | 100 |
| `hubb-fillah` | الحب في الله والصحبة الصالحة | DO | 16 | 226 |
| `husn-ishra` | حسن العشرة بين الزوجين | DO | 6 | 124 |
| `husn-khuluq` | حسن الخلق والحلم والرفق | DO | 5 | 106 |
| `idaat-al-waqt` | إضاعة الوقت واللغو | AVOID | 2 | 54 |
| `islah-bayn-nas` | الإصلاح بين الناس | DO | 1 | 5 |
| `jidal` | الجدال والمراء | AVOID | 4 | 47 |
| `kadhib` | الكذب | AVOID | 1 | 124 |
| `kafalat-yatim` | كفالة اليتيم والإحسان إلى الضعفاء | DO | 1 | 23 |
| `kalam-tayyib` | الكلمة الطيبة وطلاقة الوجه | DO | 4 | 64 |
| `khawf-raja` | الخوف من الله ورجاؤه | DO | 1 | 12 |
| `liwat` | اللواط | AVOID | 1 | 21 |
| `malahi` | اللهو المحرّم | AVOID | 4 | 49 |
| `masala` | سؤال الناس من غير حاجة | AVOID | 1 | 2 |
| `muhasaba` | محاسبة النفس | DO | 5 | 128 |
| `nafaqa-ahl` | النفقة على الأهل وتربية الأولاد | DO | 4 | 125 |
| `namimah` | النميمة | AVOID | 2 | 42 |
| `nikah` | الزواج والعفة | DO | 2 | 38 |
| `qada-hawaij` | قضاء حوائج الناس والتيسير على المعسر | DO | 7 | 163 |
| `qimar` | القمار والميسر | AVOID | 1 | 8 |
| `quran` | تلاوة القرآن وتعاهده | DO | 1 | 13 |
| `rahma-khalq` | الرحمة بالخلق والحيوان | DO | 5 | 166 |
| `sabb-lan` | السبّ واللعن والفحش | AVOID | 2 | 38 |
| `sabr` | الصبر والرضا بالقضاء | DO | 2 | 70 |
| `sadaqah` | الصدقة والإنفاق في الخير | DO | 3 | 74 |
| `salah` | المحافظة على الصلاة | DO | 1 | 13 |
| `salam` | إفشاء السلام | DO | 3 | 27 |
| `shukr` | شكر النعم | DO | 2 | 74 |
| `sidq` | الصدق | DO | 1 | 11 |
| `sukhriya` | احتقار الناس والسخرية منهم والشماتة | AVOID | 2 | 18 |
| `talab-ilm` | طلب العلم | DO | 1 | 6 |
| `tawakkul` | اليقين والتوكل على الله | DO | 1 | 2 |
| `tawba` | التوبة والاستغفار | DO | 2 | 19 |
| `tul-amal` | التعلق بالدنيا وطول الأمل | AVOID | 2 | 114 |
| `wara` | الورع وترك الشبهات | DO | 10 | 113 |
| `zuhd` | الزهد والقناعة وتذكّر الموت | DO | 5 | 61 |

## Random spot-check sample

Random sample of 25 mapped chapters (fixed for reproducible review).

| work | sectionId | title | topics |
|---|---|---|---|
| `IstinacMacruf` | `a49d91d9-3690-489f-bd55-0a7248b2bbf0` | باب طلب الحوائج إلى حسان الوجوه | `qada-hawaij` |
| `Samt` | `1a5caa69-358e-4fc6-a0fb-13ea25720ac8` | باب ذم المراء | `jidal` |
| `Samt` | `0bc1de68-9a97-485e-b175-936e1ee9c68e` | باب ذم اللعانين | `sabb-lan` |
| `DhammGhiba` | `481d7f9f-8da0-4375-8f53-917791e95b82` | باب ذم المراء | `jidal` |
| `MudaratNas` | `3c084d8a-077a-4411-b4ca-8df050738177` | باب التودد إلى الناس | `husn-khuluq` |
| `MuhasabatNafs` | `f997d560-4cbc-45d5-bdd1-ee3496704f97` | باب الحذر على النفس مخافة سوء المنقلب والمقت | `muhasaba` |
| `Samt` | `6dfaa837-a59c-4dd8-897d-acde9ba036ca` | باب الوفاء بالوعد | `amana-wafa` |
| `Ciyal` | `242a6f6a-3432-4f89-a2e2-757e5be9e227` | باب الرأفة على الولدان والرأفة بينهم | `rahma-khalq` |
| `Samt` | `c98fee0a-3384-4447-83db-7a770a08efe7` | باب ذم الفحش والبذاء | `sabb-lan` |
| `DhammMalahi` | `4263b3fb-143b-4690-8ef2-bfa08c3fa48e` | باب في القمار | `qimar` |
| `Samt` | `6ee2f08a-595d-40f1-8a38-bc809e8c386f` | باب الغيبة وذمها | `ghibah` |
| `Warac` | `a371fdb4-de02-4bc1-b7e9-cc2722fcba66` | باب الورع في الشم | `wara` |
| `IstinacMacruf` | `a12c7ab7-0c10-41fd-b970-2e777baea6c1` | باب في شكر الصنيعة | `shukr` |
| `Samt` | `574e55c8-8ebd-4b99-aa69-2e6d3ce043c8` | باب حفظ اللسان وفضل الصمت | `hifz-al-lisan` |
| `Samt` | `769829fa-8791-452c-a8f2-89eb7d3e1cc4` | باب النهي عن الكلام فيما لا يعنيك | `idaat-al-waqt` |
| `SifatJanna` | `11287b13-e7b7-4f13-8dac-a106df246b01` | باب حلي أهل الجنة | `dhikr-akhira` |
| `Warac` | `7520a7d9-e2da-4546-8f6c-e4c359f7d6e2` | باب الورع في اللسان | `wara` |
| `SifatJanna` | `2a3f633f-46c1-42df-b46e-40e6edcd0e02` | باب تزاور أهل الجنة ومنتزهاتهم | `dhikr-akhira` |
| `MudaratNas` | `f5745081-bb79-4be8-a628-6aac8ce4d567` | باب الإصلاح بين الناس | `islah-bayn-nas` |
| `SifatJanna` | `99ad93e2-2311-432a-a9c8-056acbc8afd8` | باب خدم أهل الجنة | `dhikr-akhira` |
| `SifatJanna` | `f3b66706-12c4-4ba1-a6a8-357d56301164` | باب جامع من ذكر الجنة | `dhikr-akhira` |
| `DhammGhiba` | `fa276833-a953-42d6-ae4a-3b2a25f97b07` | باب كفارة الاغتياب | `tawba` |
| `Samt` | `09a5c7a5-6d1c-4eb2-a70c-8f348d14eb3a` | باب حفظ السر | `amana-wafa` |
| `Muhtadarin` | `580ee0e2-87b5-46a6-8b54-3701c83bedcb` | باب حسن الظن بالله عند نزول الموت | `khawf-raja` |
| `IstinacMacruf` | `6efe7b77-1114-4a7a-848d-5a4de6fcd66e` | باب في الحوائج | `qada-hawaij` |

## Works skipped entirely

- `HammWaHuzn`: its sole eligible chapter, «باب ما جاء في الكمد», does not clearly name a taxonomy topic.
- `MakaidShaytan`: its sole eligible chapter is «باب أصناف الجن»; jinn material is explicitly excluded.
- `MatarWaRacd`: all four eligible chapters are rain, thunder, lightning, or wind natural lore and are explicitly excluded.
- `Hawatif`, `Manamat`, `ManCashaBacdaMawt`, and `MaqtalCali`: explicitly excluded source categories; none also has an eligible `BAB` row with `hadith > 0`.
- The following works have no eligible `BAB` row with `hadith > 0`: `Ahwal`, `AmrBiMacruf`, `Awliya`, `CaqlWaFadluh`, `CumrWaShayb`, `Cuqubat`, `Cuzla`, `DhammBaghy`, `DhammDunya`, `DhammMuskir`, `DhikrMawt`, `FadailRamadan`, `FadlCashrDhiHijja`, `FarajBacdaShidda`, `Hilm`, `HilmMucawiya`, `HusnZannBiLlah`, `IctibarWaAcqab`, `IkhlasWaNiyya`, `IshrafFiManazil`, `IslahMal`, `Juc`, `KalamLayali`, `MakarimAkhlaq`, `MaradWaKaffarat`, `MujabuDacwa`, `Mutamannin`, `QiraDayf`, `RasailFiTawakkul`, `Rida`, `RiqqaWaBuka`, `Sabr`, `Shukr`, `Tahajjud`, `TawaducWaKhumul`, `Tawakkul`, `Tawba`, `Wajal`, `Yaqin`, `Zuhd`.

## Validation output

The validation script parsed both YAML files, checked every mapped id against the TSV exports, rejected duplicate ids, required `BAB` with `hadith > 0`, and rejected unknown, contemporary, or hidden slugs.

```text
VALIDATION PASSED
eligible BAB chapters with hadith > 0: 174
mapped chapters: 132
unmapped eligible chapters: 42
unique mapped hadith items: 2547
topic links: 145

PER TOPIC (chapters, items)
adl: 1, 9
amana-wafa: 2, 18
dhikr-akhira: 22, 343
dhul-wajhayn: 2, 15
ghibah: 3, 100
hajj: 1, 14
haya: 1, 10
hifz-al-lisan: 2, 100
hubb-fillah: 16, 226
husn-ishra: 6, 124
husn-khuluq: 5, 106
idaat-al-waqt: 2, 54
islah-bayn-nas: 1, 5
jidal: 4, 47
kadhib: 1, 124
kafalat-yatim: 1, 23
kalam-tayyib: 4, 64
khawf-raja: 1, 12
liwat: 1, 21
malahi: 4, 49
masala: 1, 2
muhasaba: 5, 128
nafaqa-ahl: 4, 125
namimah: 2, 42
nikah: 2, 38
qada-hawaij: 7, 163
qimar: 1, 8
quran: 1, 13
rahma-khalq: 5, 166
sabb-lan: 2, 38
sabr: 2, 70
sadaqah: 3, 74
salah: 1, 13
salam: 3, 27
shukr: 2, 74
sidq: 1, 11
sukhriya: 2, 18
talab-ilm: 1, 6
tawakkul: 1, 2
tawba: 2, 19
tul-amal: 2, 114
wara: 10, 113
zuhd: 5, 61

PER WORK (chapters, items)
Ciyal: 22, 501
DhammGhiba: 7, 109
DhammMalahi: 6, 78
Ikhwan: 16, 226
IstinacMacruf: 6, 143
MudaratNas: 8, 136
MuhasabatNafs: 5, 128
Muhtadarin: 2, 52
QadaHawaij: 3, 94
Qanaca: 4, 17
QasrAmal: 2, 114
Qubur: 2, 57
Samt: 19, 493
SifatJanna: 19, 270
SifatNar: 1, 16
Warac: 10, 113
```
