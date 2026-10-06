/**
 * Thekra – development seed  (backend/prisma/seed.ts)
 *
 * Populates a local database with enough curated content for every screen to
 * render before any external provider integration exists.
 *
 * Every write is an upsert — re-running is always safe (idempotent).
 *
 * Safety: refuses to run when NODE_ENV === 'production'
 * unless SEED_ALLOW_PRODUCTION=true.
 *
 * Exported functions (e2e helpers can import and call subsets):
 *   seedSources, seedTags, seedSins, seedGoodDeeds, seedQuotes,
 *   seedTranslations, seedLinks, seedUsers, seedFavorites, seedSyncLogs
 */

import {
  PrismaClient,
  SourceType,
  QuoteType,
  QuoteOrigin,
  HadithGrade,
  TagCategory,
  SyncStatus,
  UserRole,
  LinkReviewStatus,
} from '@prisma/client';
import { hash as argon2hash, argon2id } from 'argon2';
import { fileURLToPath } from 'url';

// ── Safety guard ─────────────────────────────────────────────────────────────
if (
  process.env['NODE_ENV'] === 'production' &&
  process.env['SEED_ALLOW_PRODUCTION'] !== 'true'
) {
  console.error(
    '❌  Refusing to seed: NODE_ENV=production. ' +
      'Set SEED_ALLOW_PRODUCTION=true to override.',
  );
  process.exit(1);
}

const prisma = new PrismaClient();

// ── Fixed UUID constants ──────────────────────────────────────────────────────
// Using fixed IDs for all rows that lack a natural unique key in the schema
// (Source.name, SyncLog) and for Quote (no natural key for LOCAL rows).
// Fixed IDs make upserts deterministic and let e2e fixtures reference them.

// Sources  1xxxxxxx-...
const SRC_QURAN      = '10000000-0000-4000-8000-000000000001';
const SRC_BUKHARI    = '10000000-0000-4000-8000-000000000002';
const SRC_MUSLIM     = '10000000-0000-4000-8000-000000000003';
const SRC_IBN_QAYYIM = '10000000-0000-4000-8000-000000000004';
const SRC_QURAN_COM  = '10000000-0000-4000-8000-000000000005';

// Sins  a0000000-... (also in create so IDs are stable from first run)
const SIN_GHIBAH        = 'a0000000-0000-4000-8000-000000000001';
const SIN_NAMIMAH       = 'a0000000-0000-4000-8000-000000000002';
const SIN_KADHIB        = 'a0000000-0000-4000-8000-000000000003';
const SIN_HASAD         = 'a0000000-0000-4000-8000-000000000004';
const SIN_RIYA          = 'a0000000-0000-4000-8000-000000000005';
const SIN_QAT_AL_RAHIM  = 'a0000000-0000-4000-8000-000000000006';
const SIN_TARK_AS_SALAH = 'a0000000-0000-4000-8000-000000000007';
const SIN_GHADAB        = 'a0000000-0000-4000-8000-000000000008';

// Good Deeds  b0000000-...
const DEED_HIFZ        = 'b0000000-0000-4000-8000-000000000001';
const DEED_SADAQAH     = 'b0000000-0000-4000-8000-000000000002';
const DEED_SILAT       = 'b0000000-0000-4000-8000-000000000003';
const DEED_SALAT_JAM   = 'b0000000-0000-4000-8000-000000000004';
const DEED_IKHLAS      = 'b0000000-0000-4000-8000-000000000005';
const DEED_KAFF_GHADAB = 'b0000000-0000-4000-8000-000000000006';
const DEED_DHIKR       = 'b0000000-0000-4000-8000-000000000007';
const DEED_BIRR        = 'b0000000-0000-4000-8000-000000000008';

// Tags  c0000000-...
const TAG_ANGER        = 'c0000000-0000-4000-8000-000000000001';
const TAG_DESPAIR      = 'c0000000-0000-4000-8000-000000000002';
const TAG_LONELINESS   = 'c0000000-0000-4000-8000-000000000003';
const TAG_ENVY         = 'c0000000-0000-4000-8000-000000000004';
const TAG_FORGIVENESS  = 'c0000000-0000-4000-8000-000000000005';
const TAG_PATIENCE     = 'c0000000-0000-4000-8000-000000000006';
const TAG_HEREAFTER    = 'c0000000-0000-4000-8000-000000000007';
const TAG_TONGUE       = 'c0000000-0000-4000-8000-000000000008';
const TAG_BACKBITING   = 'c0000000-0000-4000-8000-000000000009';
const TAG_TALE_BEARING = 'c0000000-0000-4000-8000-000000000010';
const TAG_CHARITY      = 'c0000000-0000-4000-8000-000000000011';
const TAG_REMEMBRANCE  = 'c0000000-0000-4000-8000-000000000012';

// Quotes  00000000-0000-4000-8000-00000000000N  (plan §5.2 format)
const Q01 = '00000000-0000-4000-8000-000000000001'; // QURAN_VERSE  API_CACHED  Al-Hujurat 49:12
const Q02 = '00000000-0000-4000-8000-000000000002'; // QURAN_VERSE  LOCAL       Al-Hujurat 49:11
const Q03 = '00000000-0000-4000-8000-000000000003'; // QURAN_VERSE  LOCAL       An-Nisa 4:36
const Q04 = '00000000-0000-4000-8000-000000000004'; // QURAN_VERSE  LOCAL       Al-Anfal 8:46
const Q05 = '00000000-0000-4000-8000-000000000005'; // QURAN_VERSE  LOCAL       At-Tawbah 9:119
const Q06 = '00000000-0000-4000-8000-000000000006'; // QURAN_VERSE  LOCAL       Al-Jumu'ah 62:9
const Q07 = '00000000-0000-4000-8000-000000000007'; // QURAN_VERSE  LOCAL       Al-Bayyinah 98:5
const Q08 = '00000000-0000-4000-8000-000000000008'; // QURAN_VERSE  LOCAL       Al-Baqarah 2:261
const Q09 = '00000000-0000-4000-8000-000000000009'; // HADITH  API_CACHED  SAHIH   Muslim 2589
const Q10 = '00000000-0000-4000-8000-000000000010'; // HADITH  LOCAL       SAHIH   Bukhari 6018
const Q11 = '00000000-0000-4000-8000-000000000011'; // HADITH  LOCAL       SAHIH   envy warning
const Q12 = '00000000-0000-4000-8000-000000000012'; // HADITH  LOCAL       SAHIH   prayer expiation
const Q13 = '00000000-0000-4000-8000-000000000013'; // HADITH  LOCAL       SAHIH   anger control
const Q14 = '00000000-0000-4000-8000-000000000014'; // HADITH  LOCAL       HASAN   truthfulness
const Q15 = '00000000-0000-4000-8000-000000000015'; // HADITH  LOCAL       HASAN   silat ar-rahim
const Q16 = '00000000-0000-4000-8000-000000000016'; // HADITH  LOCAL       DAIF    riya warning
const Q17 = '00000000-0000-4000-8000-000000000017'; // SCHOLAR_QUOTE LOCAL  Ibn al-Qayyim on tongue
const Q18 = '00000000-0000-4000-8000-000000000018'; // SCHOLAR_QUOTE LOCAL  Ibn al-Qayyim on anger
const Q19 = '00000000-0000-4000-8000-000000000019'; // BOOK_EXCERPT  LOCAL  Madarij al-Salikin
const Q20 = '00000000-0000-4000-8000-000000000020'; // BOOK_EXCERPT  LOCAL  Al-Jawab al-Kafi

// Users  20000000-...
const U_USER  = '20000000-0000-4000-8000-000000000001';
const U_ADMIN = '20000000-0000-4000-8000-000000000002';

// SyncLogs  30000000-...
const SL01 = '30000000-0000-4000-8000-000000000001';
const SL02 = '30000000-0000-4000-8000-000000000002';
const SL03 = '30000000-0000-4000-8000-000000000003';

// ─────────────────────────────────────────────────────────────────────────────
// seedSources — 5 rows
// Upsert key: id (Source.name is not @unique in schema; fixed IDs ensure
// idempotency and allow stable FK references from other seed functions).
// ─────────────────────────────────────────────────────────────────────────────
export async function seedSources(): Promise<void> {
  const sources = [
    {
      id: SRC_QURAN,
      name: "The Noble Qur'an",
      nameAr: 'القرآن الكريم',
      type: SourceType.QURAN,
      isExternalApi: false,
    },
    {
      id: SRC_BUKHARI,
      name: 'Sahih al-Bukhari',
      nameAr: 'صحيح البخاري',
      type: SourceType.HADITH_COLLECTION,
      isExternalApi: false,
    },
    {
      id: SRC_MUSLIM,
      name: 'Sahih Muslim',
      nameAr: 'صحيح مسلم',
      type: SourceType.HADITH_COLLECTION,
      isExternalApi: false,
    },
    {
      id: SRC_IBN_QAYYIM,
      name: 'Ibn al-Qayyim',
      nameAr: 'ابن القيم',
      type: SourceType.SCHOLAR,
      author: 'Ibn Qayyim al-Jawziyyah',
      authorAr: 'ابن قيم الجوزية',
      isExternalApi: false,
    },
    {
      // isExternalApi=true → valid target for POST /admin/content-sync/runs
      // lastSyncedAt omitted from create (nullable, defaults to null) and from
      // update (so a real sync timestamp is not overwritten by re-seeding).
      id: SRC_QURAN_COM,
      name: 'Quran.com (API)',
      nameAr: 'القرآن الكريم',
      type: SourceType.QURAN,
      isExternalApi: true,
      apiProvider: 'quran.com',
      apiBaseUrl: 'https://api.quran.com/api/v4',
    },
  ];

  for (const src of sources) {
    const { id, ...fields } = src;
    await prisma.source.upsert({
      where: { id },
      create: { id, ...fields },
      update: fields,
    });
  }

  // Owner-named works (metadata only — no book text).
  // Dynamic .ts import: `prisma db seed` runs this file with Node type-stripping,
  // which does not rewrite a `.js` specifier to the `.ts` source.
  const { APPROVED_WORKS } = (await import(
    new URL('./imports/approved-works.ts', import.meta.url).href
  )) as {
    APPROVED_WORKS: ReadonlyArray<{
      id: string;
      name: string;
      nameAr: string;
      type: SourceType;
      author: string;
      authorAr: string;
      bookKey: string;
    }>;
  };
  for (const work of APPROVED_WORKS) {
    const fields = {
      name: work.name,
      nameAr: work.nameAr,
      type: work.type,
      author: work.author,
      authorAr: work.authorAr,
      isExternalApi: false,
      apiProvider: work.bookKey,
    };
    await prisma.source.upsert({
      where: { id: work.id },
      create: { id: work.id, ...fields },
      update: fields,
    });
  }
  console.log(`sources: ${sources.length + APPROVED_WORKS.length} upserted`);
}

// ─────────────────────────────────────────────────────────────────────────────
// seedTags — 12 rows (4 EMOTION · 4 THEME · 2 SIN · 2 GOOD_DEED)
// Upsert key: slug (@unique in schema); fixed id in create for stable FK refs.
// ─────────────────────────────────────────────────────────────────────────────
export async function seedTags(): Promise<void> {
  const tags = [
    // EMOTION — power the /feelings/[tagSlug] entry point
    { id: TAG_ANGER,       slug: 'anger',       name: 'Anger',       nameAr: 'الغضب',   category: TagCategory.EMOTION },
    { id: TAG_DESPAIR,     slug: 'despair',     name: 'Despair',     nameAr: 'اليأس',   category: TagCategory.EMOTION },
    { id: TAG_LONELINESS,  slug: 'loneliness',  name: 'Loneliness',  nameAr: 'الوحدة',  category: TagCategory.EMOTION },
    { id: TAG_ENVY,        slug: 'envy',        name: 'Envy',        nameAr: 'الحسد',   category: TagCategory.EMOTION },
    // THEME
    { id: TAG_FORGIVENESS, slug: 'forgiveness', name: 'Forgiveness', nameAr: 'المغفرة', category: TagCategory.THEME },
    { id: TAG_PATIENCE,    slug: 'patience',    name: 'Patience',    nameAr: 'الصبر',   category: TagCategory.THEME },
    { id: TAG_HEREAFTER,   slug: 'hereafter',   name: 'Hereafter',   nameAr: 'الآخرة',  category: TagCategory.THEME },
    { id: TAG_TONGUE,      slug: 'tongue',      name: 'Tongue',      nameAr: 'اللسان',  category: TagCategory.THEME },
    // SIN
    { id: TAG_BACKBITING,  slug: 'backbiting',  name: 'Backbiting',  nameAr: 'الغيبة',  category: TagCategory.SIN },
    { id: TAG_TALE_BEARING,slug: 'tale-bearing',name: 'Tale-bearing',nameAr: 'النميمة', category: TagCategory.SIN },
    // GOOD_DEED
    { id: TAG_CHARITY,     slug: 'charity',     name: 'Charity',     nameAr: 'الصدقة',  category: TagCategory.GOOD_DEED },
    { id: TAG_REMEMBRANCE, slug: 'remembrance', name: 'Remembrance', nameAr: 'الذكر',   category: TagCategory.GOOD_DEED },
  ];

  for (const tag of tags) {
    const { id, ...fields } = tag;
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      create: { id, ...fields },
      update: fields,
    });
  }
  console.log(`tags: ${tags.length} upserted`);
}

// ─────────────────────────────────────────────────────────────────────────────
// seedSins — 8 rows
// Upsert key: slug (@unique); fixed id in create for stable oppositeSinId refs.
// ─────────────────────────────────────────────────────────────────────────────
export async function seedSins(): Promise<void> {
  const sins = [
    {
      id: SIN_GHIBAH,
      name: 'Backbiting',
      nameAr: 'الغيبة',
      slug: 'ghibah',
      category: 'speech',
      severity: 4,
      description: 'Mentioning a person in their absence in a way they would dislike.',
      descriptionAr: 'ذكر الشخص في غيابه بما يكره',
    },
    {
      id: SIN_NAMIMAH,
      name: 'Tale-bearing',
      nameAr: 'النميمة',
      slug: 'namimah',
      category: 'speech',
      severity: 4,
      description: 'Carrying tales between people to sow discord.',
      descriptionAr: 'نقل الكلام بين الناس بقصد الإفساد',
    },
    {
      id: SIN_KADHIB,
      name: 'Lying',
      nameAr: 'الكذب',
      slug: 'kadhib',
      category: 'speech',
      severity: 4,
      description: 'Speaking falsehood deliberately.',
      descriptionAr: 'التعبير عن الشيء على خلاف ما هو عليه في الواقع',
    },
    {
      id: SIN_HASAD,
      name: 'Envy',
      nameAr: 'الحسد',
      slug: 'hasad',
      category: 'heart',
      severity: 3,
      description: 'Wishing for the removal of a blessing from another person.',
      descriptionAr: 'تمني زوال نعمة الغير',
    },
    {
      id: SIN_RIYA,
      name: 'Ostentation',
      nameAr: 'الرياء',
      slug: 'riya',
      category: 'heart',
      severity: 5,
      description: 'Performing acts of worship to be seen by people rather than for Allah alone.',
      descriptionAr: 'العمل لأجل رؤية الناس لا لوجه الله',
    },
    {
      id: SIN_QAT_AL_RAHIM,
      name: 'Severing Family Ties',
      nameAr: 'قطع الرحم',
      slug: 'qat-al-rahim',
      category: 'family',
      severity: 5,
      description: 'Breaking the bonds of kinship by abandoning or harming relatives.',
      descriptionAr: 'قطع صلة الأرحام والتقصير في حقوقهم',
    },
    {
      id: SIN_TARK_AS_SALAH,
      name: 'Abandoning Prayer',
      nameAr: 'ترك الصلاة',
      slug: 'tark-as-salah',
      category: 'worship',
      severity: 5,
      description: 'Neglecting the obligatory prayers without a valid excuse.',
      descriptionAr: 'التهاون في الصلاة أو تركها بلا عذر شرعي',
    },
    {
      id: SIN_GHADAB,
      name: 'Anger',
      nameAr: 'الغضب',
      slug: 'ghadab',
      category: 'heart',
      severity: 2,
      description: 'Uncontrolled rage that leads to harm of oneself or others.',
      descriptionAr: 'الغضب المفضي إلى الأذى بالنفس أو الغير',
    },
  ];

  for (const sin of sins) {
    const { id, ...fields } = sin;
    await prisma.sin.upsert({
      where: { slug: sin.slug },
      create: { id, ...fields },
      update: fields,
    });
  }
  console.log(`sins: ${sins.length} upserted`);
}

// ─────────────────────────────────────────────────────────────────────────────
// seedGoodDeeds — 8 rows
// Upsert key: slug. oppositeSinId uses fixed sin UUIDs set above.
// 6 deeds wired to their opposite sin; sadaqah and dhikr left free.
// ─────────────────────────────────────────────────────────────────────────────
export async function seedGoodDeeds(): Promise<void> {
  const goodDeeds = [
    {
      id: DEED_HIFZ,
      name: 'Guarding the Tongue',
      nameAr: 'حفظ اللسان',
      slug: 'hifz-al-lisan',
      category: 'character',
      description: 'Refraining from harmful speech and speaking only what is good.',
      descriptionAr: 'الكف عن كل كلام محرم أو مكروه والاقتصار على الخير',
      reward: "Guarantee of paradise for one who guards their tongue and private parts.",
      rewardAr: 'ضمان الجنة لمن حفظ لسانه وفرجه',
      oppositeSinId: SIN_GHIBAH,
    },
    {
      id: DEED_SADAQAH,
      name: 'Charity',
      nameAr: 'الصدقة',
      slug: 'sadaqah',
      category: 'worship',
      description: 'Giving voluntary charity for the sake of Allah.',
      descriptionAr: 'التصدق طوعاً في سبيل الله',
      reward: "Charity is multiplied up to 700 times by Allah, and extinguishes sins as water extinguishes fire.",
      rewardAr: 'الصدقة تُضاعَف إلى سبعمائة ضعف وتطفئ الخطيئة كما يطفئ الماء النار',
      oppositeSinId: null,
    },
    {
      id: DEED_SILAT,
      name: 'Maintaining Family Ties',
      nameAr: 'صلة الرحم',
      slug: 'silat-ar-rahim',
      category: 'family',
      description: 'Keeping bonds of kinship with relatives and fulfilling their rights.',
      descriptionAr: 'الحفاظ على صلة الأرحام وأداء حقوقهم',
      reward: "Allah expands provisions and extends the lifespan for one who maintains family ties.",
      rewardAr: 'يُبسط له في رزقه ويُنسأ له في أجله',
      oppositeSinId: SIN_QAT_AL_RAHIM,
    },
    {
      id: DEED_SALAT_JAM,
      name: 'Prayer in Congregation',
      nameAr: 'صلاة الجماعة',
      slug: 'salat-fi-jamaah',
      category: 'worship',
      description: 'Performing the five daily prayers in congregation at the mosque.',
      descriptionAr: 'أداء الصلوات الخمس في المسجد مع الجماعة',
      reward: "Prayer in congregation is 27 degrees superior to individual prayer.",
      rewardAr: 'صلاة الجماعة تفضل صلاة الفذ بسبع وعشرين درجة',
      oppositeSinId: SIN_TARK_AS_SALAH,
    },
    {
      id: DEED_IKHLAS,
      name: 'Sincerity',
      nameAr: 'الإخلاص',
      slug: 'ikhlas',
      category: 'heart',
      description: 'Dedicating all acts of worship purely to Allah without seeking praise.',
      descriptionAr: 'إفراد الله بالعبادة وإخلاص النية له وحده',
      reward: "A single deed done with pure sincerity outweighs a mountain of deeds tainted with ostentation.",
      rewardAr: 'العمل المخلص القليل يفوق العمل الكثير المشوب بالرياء',
      oppositeSinId: SIN_RIYA,
    },
    {
      id: DEED_KAFF_GHADAB,
      name: 'Suppressing Anger',
      nameAr: 'كف الغضب',
      slug: 'kaff-al-ghadab',
      category: 'character',
      description: 'Controlling and suppressing anger for the sake of Allah.',
      descriptionAr: 'ضبط النفس وكبت الغضب ابتغاء وجه الله',
      reward: "Allah will call those who suppress their anger before all of creation to choose from the houris of paradise.",
      rewardAr: 'ناداه الله على رؤوس الخلائق يوم القيامة يخيره من الحور العين ما شاء',
      oppositeSinId: SIN_GHADAB,
    },
    {
      id: DEED_DHIKR,
      name: 'Remembrance of Allah',
      nameAr: 'الذكر',
      slug: 'dhikr',
      category: 'worship',
      description: 'Frequently remembering Allah through glorification, praise, and supplication.',
      descriptionAr: 'الإكثار من ذكر الله تسبيحاً وتحميداً ودعاءً',
      reward: "Hearts find their peace and tranquility in the remembrance of Allah.",
      rewardAr: 'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ',
      oppositeSinId: null,
    },
    {
      id: DEED_BIRR,
      name: 'Honoring Parents',
      nameAr: 'بر الوالدين',
      slug: 'birr-al-walidayn',
      category: 'family',
      description: "Showing gratitude, kindness, and obedience to one's parents.",
      descriptionAr: 'طاعة الوالدين وإحسان معاملتهما والقيام بحقوقهما',
      reward: "Honoring parents is among the deeds most beloved to Allah and is a key to paradise.",
      rewardAr: 'بر الوالدين من أحب الأعمال إلى الله وفيه الجنة للمطيع',
      oppositeSinId: null,
    },
  ];

  for (const deed of goodDeeds) {
    const { id, ...fields } = deed;
    await prisma.goodDeed.upsert({
      where: { slug: deed.slug },
      create: { id, ...fields },
      update: fields,
    });
  }
  const withOpposite = goodDeeds.filter((d) => d.oppositeSinId !== null).length;
  console.log(`good deeds: ${goodDeeds.length} upserted (${withOpposite} with oppositeSinId)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// seedQuotes — 20 rows
// Upsert key: id (fixed UUIDs 00000000-0000-4000-8000-00000000000N).
//
// Type breakdown:
//   QURAN_VERSE  × 8  (Q01–Q08)  grade=null proves grade filter won't drop verses
//   HADITH       × 8  (Q09–Q16)  grades: SAHIH×5, HASAN×2, DAIF×1 — no MAWDU
//   SCHOLAR_QUOTE × 2 (Q17–Q18)
//   BOOK_EXCERPT  × 2 (Q19–Q20)
//
// API_CACHED rows: Q01 (quran.com / 49:12), Q09 (sunnah.com / muslim:2589)
// Both carry rawPayload to prove the serialiser never leaks it to end users.
// ─────────────────────────────────────────────────────────────────────────────
export async function seedQuotes(): Promise<void> {
  // Define each quote. Fields absent for a type stay undefined (Prisma ignores them).
  const quotes = [
    // ── QURAN_VERSE ──────────────────────────────────────────────────────
    {
      id: Q01,
      type: QuoteType.QURAN_VERSE,
      origin: QuoteOrigin.API_CACHED,
      textAr:
        'يَا أَيُّهَا الَّذِينَ آمَنُوا اجْتَنِبُوا كَثِيرًا مِنَ الظَّنِّ إِنَّ بَعْضَ الظَّنِّ إِثْمٌ' +
        ' وَلَا تَجَسَّسُوا وَلَا يَغْتَبْ بَعْضُكُمْ بَعْضًا أَيُحِبُّ أَحَدُكُمْ أَنْ يَأْكُلَ' +
        ' لَحْمَ أَخِيهِ مَيْتًا فَكَرِهْتُمُوهُ',
      sourceId: SRC_QURAN_COM,
      surahNumber: 49,
      surahName: 'Al-Hujurat',
      surahNameAr: 'الحجرات',
      ayahNumber: 12,
      apiProvider: 'quran.com',
      externalId: '49:12',
      rawPayload: {
        id: 2741,
        verse_number: 12,
        verse_key: '49:12',
        chapter_id: 49,
        text_uthmani:
          'يَٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُوا۟ ٱجْتَنِبُوا۟ كَثِيرًا مِّنَ ٱلظَّنِّ',
        juz_number: 26,
        page_number: 517,
        translations: [
          {
            id: 9100,
            resource_id: 131,
            text: 'O you who have believed, avoid much [negative] assumption…',
          },
        ],
      },
    },
    {
      id: Q02,
      type: QuoteType.QURAN_VERSE,
      origin: QuoteOrigin.LOCAL,
      textAr:
        'يَا أَيُّهَا الَّذِينَ آمَنُوا لَا يَسْخَرْ قَوْمٌ مِنْ قَوْمٍ عَسَى أَنْ يَكُونُوا' +
        ' خَيْرًا مِنْهُمْ وَلَا نِسَاءٌ مِنْ نِسَاءٍ عَسَى أَنْ يَكُنَّ خَيْرًا مِنْهُنَّ',
      sourceId: SRC_QURAN,
      surahNumber: 49,
      surahName: 'Al-Hujurat',
      surahNameAr: 'الحجرات',
      ayahNumber: 11,
    },
    {
      id: Q03,
      type: QuoteType.QURAN_VERSE,
      origin: QuoteOrigin.LOCAL,
      textAr:
        'وَاعْبُدُوا اللَّهَ وَلَا تُشْرِكُوا بِهِ شَيْئًا وَبِالْوَالِدَيْنِ إِحْسَانًا' +
        ' وَبِذِي الْقُرْبَى وَالْيَتَامَى وَالْمَسَاكِينِ',
      sourceId: SRC_QURAN,
      surahNumber: 4,
      surahName: 'An-Nisa',
      surahNameAr: 'النساء',
      ayahNumber: 36,
    },
    {
      id: Q04,
      type: QuoteType.QURAN_VERSE,
      origin: QuoteOrigin.LOCAL,
      textAr:
        'وَأَطِيعُوا اللَّهَ وَرَسُولَهُ وَلَا تَنَازَعُوا فَتَفْشَلُوا وَتَذْهَبَ رِيحُكُمْ' +
        ' وَاصْبِرُوا إِنَّ اللَّهَ مَعَ الصَّابِرِينَ',
      sourceId: SRC_QURAN,
      surahNumber: 8,
      surahName: 'Al-Anfal',
      surahNameAr: 'الأنفال',
      ayahNumber: 46,
    },
    {
      id: Q05,
      type: QuoteType.QURAN_VERSE,
      origin: QuoteOrigin.LOCAL,
      textAr: 'يَا أَيُّهَا الَّذِينَ آمَنُوا اتَّقُوا اللَّهَ وَكُونُوا مَعَ الصَّادِقِينَ',
      sourceId: SRC_QURAN,
      surahNumber: 9,
      surahName: 'At-Tawbah',
      surahNameAr: 'التوبة',
      ayahNumber: 119,
    },
    {
      id: Q06,
      type: QuoteType.QURAN_VERSE,
      origin: QuoteOrigin.LOCAL,
      textAr:
        'يَا أَيُّهَا الَّذِينَ آمَنُوا إِذَا نُودِيَ لِلصَّلَاةِ مِنْ يَوْمِ الْجُمُعَةِ' +
        ' فَاسْعَوْا إِلَى ذِكْرِ اللَّهِ وَذَرُوا الْبَيْعَ',
      sourceId: SRC_QURAN,
      surahNumber: 62,
      surahName: "Al-Jumu'ah",
      surahNameAr: 'الجمعة',
      ayahNumber: 9,
    },
    {
      id: Q07,
      type: QuoteType.QURAN_VERSE,
      origin: QuoteOrigin.LOCAL,
      textAr:
        'وَمَا أُمِرُوا إِلَّا لِيَعْبُدُوا اللَّهَ مُخْلِصِينَ لَهُ الدِّينَ حُنَفَاءَ',
      sourceId: SRC_QURAN,
      surahNumber: 98,
      surahName: 'Al-Bayyinah',
      surahNameAr: 'البينة',
      ayahNumber: 5,
    },
    {
      id: Q08,
      type: QuoteType.QURAN_VERSE,
      origin: QuoteOrigin.LOCAL,
      textAr:
        'مَثَلُ الَّذِينَ يُنْفِقُونَ أَمْوَالَهُمْ فِي سَبِيلِ اللَّهِ كَمَثَلِ حَبَّةٍ' +
        ' أَنْبَتَتْ سَبْعَ سَنَابِلَ فِي كُلِّ سُنْبُلَةٍ مِائَةُ حَبَّةٍ وَاللَّهُ يُضَاعِفُ لِمَنْ يَشَاءُ',
      sourceId: SRC_QURAN,
      surahNumber: 2,
      surahName: 'Al-Baqarah',
      surahNameAr: 'البقرة',
      ayahNumber: 261,
    },
    // ── HADITH ───────────────────────────────────────────────────────────
    {
      id: Q09,
      type: QuoteType.HADITH,
      origin: QuoteOrigin.API_CACHED,
      textAr:
        'أَتَدْرُونَ مَا الْغِيبَةُ قَالُوا اللَّهُ وَرَسُولُهُ أَعْلَمُ قَالَ ذِكْرُكَ أَخَاكَ' +
        ' بِمَا يَكْرَهُ قِيلَ أَفَرَأَيْتَ إِنْ كَانَ فِي أَخِي مَا أَقُولُ قَالَ إِنْ كَانَ فِيهِ' +
        ' مَا تَقُولُ فَقَدِ اغْتَبْتَهُ وَإِنْ لَمْ يَكُنْ فِيهِ فَقَدْ بَهَتَّهُ',
      sourceId: SRC_MUSLIM,
      narrator: 'Abu Hurairah (may Allah be pleased with him)',
      narratorAr: 'أبو هريرة رضي الله عنه',
      grade: HadithGrade.SAHIH,
      hadithReference: 'Muslim 2589',
      apiProvider: 'sunnah.com',
      externalId: 'muslim:2589',
      rawPayload: {
        collection: 'muslim',
        bookNumber: '45',
        hadithNumber: '2589',
        hadith: [
          {
            lang: 'ar',
            body: 'أَتَدْرُونَ مَا الْغِيبَةُ…',
            grades: [{ graded_by: '', grade: 'صحيح' }],
          },
          {
            lang: 'en',
            body: 'Do you know what backbiting is?…',
            grades: [{ graded_by: 'Al-Albani', grade: 'Sahih' }],
          },
        ],
      },
    },
    {
      id: Q10,
      type: QuoteType.HADITH,
      origin: QuoteOrigin.LOCAL,
      textAr:
        'مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الْآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ',
      sourceId: SRC_BUKHARI,
      narrator: 'Abu Hurairah (may Allah be pleased with him)',
      narratorAr: 'أبو هريرة رضي الله عنه',
      grade: HadithGrade.SAHIH,
      hadithReference: 'Bukhari 6018',
    },
    {
      id: Q11,
      type: QuoteType.HADITH,
      origin: QuoteOrigin.LOCAL,
      textAr:
        'إِيَّاكُمْ وَالْحَسَدَ فَإِنَّ الْحَسَدَ يَأْكُلُ الْحَسَنَاتِ كَمَا تَأْكُلُ النَّارُ الْحَطَبَ',
      sourceId: SRC_BUKHARI,
      narrator: 'Abu Hurairah (may Allah be pleased with him)',
      narratorAr: 'أبو هريرة رضي الله عنه',
      grade: HadithGrade.SAHIH,
      hadithReference: 'Abu Dawud 4903',
    },
    {
      id: Q12,
      type: QuoteType.HADITH,
      origin: QuoteOrigin.LOCAL,
      textAr:
        'الصَّلَوَاتُ الْخَمْسُ وَالْجُمُعَةُ إِلَى الْجُمُعَةِ وَرَمَضَانُ إِلَى رَمَضَانَ' +
        ' مُكَفِّرَاتٌ مَا بَيْنَهُنَّ إِذَا اجْتُنِبَتِ الْكَبَائِرُ',
      sourceId: SRC_MUSLIM,
      narrator: 'Abu Hurairah (may Allah be pleased with him)',
      narratorAr: 'أبو هريرة رضي الله عنه',
      grade: HadithGrade.SAHIH,
      hadithReference: 'Muslim 233',
    },
    {
      id: Q13,
      type: QuoteType.HADITH,
      origin: QuoteOrigin.LOCAL,
      textAr:
        'لَيْسَ الشَّدِيدُ بِالصُّرَعَةِ إِنَّمَا الشَّدِيدُ الَّذِي يَمْلِكُ نَفْسَهُ عِنْدَ الْغَضَبِ',
      sourceId: SRC_BUKHARI,
      narrator: 'Abu Hurairah (may Allah be pleased with him)',
      narratorAr: 'أبو هريرة رضي الله عنه',
      grade: HadithGrade.SAHIH,
      hadithReference: 'Bukhari 6114',
    },
    {
      id: Q14,
      type: QuoteType.HADITH,
      origin: QuoteOrigin.LOCAL,
      textAr:
        'عَلَيْكُمْ بِالصِّدْقِ فَإِنَّ الصِّدْقَ يَهْدِي إِلَى الْبِرِّ وَإِنَّ الْبِرَّ يَهْدِي إِلَى' +
        ' الْجَنَّةِ وَمَا يَزَالُ الرَّجُلُ يَصْدُقُ وَيَتَحَرَّى الصِّدْقَ حَتَّى يُكْتَبَ عِنْدَ اللَّهِ صِدِّيقًا',
      sourceId: SRC_BUKHARI,
      narrator: "Ibn Mas'ud (may Allah be pleased with him)",
      narratorAr: 'عبد الله بن مسعود رضي الله عنه',
      grade: HadithGrade.HASAN,
      hadithReference: 'Bukhari 6094',
    },
    {
      id: Q15,
      type: QuoteType.HADITH,
      origin: QuoteOrigin.LOCAL,
      textAr:
        'مَنْ أَحَبَّ أَنْ يُبْسَطَ لَهُ فِي رِزْقِهِ وَيُنْسَأَ لَهُ فِي أَثَرِهِ فَلْيَصِلْ رَحِمَهُ',
      sourceId: SRC_BUKHARI,
      narrator: 'Anas ibn Malik (may Allah be pleased with him)',
      narratorAr: 'أنس بن مالك رضي الله عنه',
      grade: HadithGrade.HASAN,
      hadithReference: 'Bukhari 5986',
    },
    {
      // DAIF — only 1 as required; must never be MAWDU
      id: Q16,
      type: QuoteType.HADITH,
      origin: QuoteOrigin.LOCAL,
      textAr:
        'إِنَّ أَخْوَفَ مَا أَخَافُ عَلَيْكُمُ الشِّرْكُ الْأَصْغَرُ الرِّيَاءُ',
      sourceId: SRC_BUKHARI,
      narrator: 'Mahmud ibn Lubayd (may Allah be pleased with him)',
      narratorAr: 'محمود بن لبيد رضي الله عنه',
      grade: HadithGrade.DAIF,
      hadithReference: 'Ahmad 5/428',
    },
    // ── SCHOLAR_QUOTE ─────────────────────────────────────────────────────
    {
      id: Q17,
      type: QuoteType.SCHOLAR_QUOTE,
      origin: QuoteOrigin.LOCAL,
      textAr: 'اللِّسَانُ سَبُعٌ إِنْ أُطْلِقَ أَكَلَ',
      sourceId: SRC_IBN_QAYYIM,
      author: 'Ibn Qayyim al-Jawziyyah',
    },
    {
      id: Q18,
      type: QuoteType.SCHOLAR_QUOTE,
      origin: QuoteOrigin.LOCAL,
      textAr: 'الْغَضَبُ جَمْرَةٌ يُلْقِيهَا الشَّيْطَانُ فِي قَلْبِ ابْنِ آدَمَ',
      sourceId: SRC_IBN_QAYYIM,
      author: 'Ibn Qayyim al-Jawziyyah',
    },
    // ── BOOK_EXCERPT ──────────────────────────────────────────────────────
    {
      id: Q19,
      type: QuoteType.BOOK_EXCERPT,
      origin: QuoteOrigin.LOCAL,
      textAr:
        'الْغِيبَةُ أَنْ تَذْكُرَ أَخَاكَ بِمَا يَكْرَهُ سَوَاءٌ كَانَ ذَلِكَ' +
        ' فِي بَدَنِهِ أَوْ دِينِهِ أَوْ دُنْيَاهُ أَوْ نَفْسِهِ',
      sourceId: SRC_IBN_QAYYIM,
      bookTitle: 'Madarij al-Salikin',
      author: 'Ibn Qayyim al-Jawziyyah',
      pageOrChapter: 'Vol. 2, p. 294',
    },
    {
      id: Q20,
      type: QuoteType.BOOK_EXCERPT,
      origin: QuoteOrigin.LOCAL,
      textAr:
        'إِنَّ الْغَضَبَ إِذَا تَمَكَّنَ مِنَ الْقَلْبِ أَعْمَى صَاحِبَهُ وَأَصَمَّهُ' +
        ' وَحَجَبَ عَنْهُ نُورَ الْعَقْلِ',
      sourceId: SRC_IBN_QAYYIM,
      bookTitle: 'Al-Jawab al-Kafi',
      author: 'Ibn Qayyim al-Jawziyyah',
      pageOrChapter: 'Ch. 7',
    },
  ];

  let apiCachedCount = 0;
  for (const quote of quotes) {
    const { id, ...fields } = quote;
    await prisma.quote.upsert({
      where: { id },
      create: { id, ...fields },
      update: fields,
    });
    if (quote.origin === QuoteOrigin.API_CACHED) apiCachedCount++;
  }
  console.log(
    `quotes: ${quotes.length} upserted` +
      ` (${apiCachedCount} API_CACHED, ${quotes.length - apiCachedCount} LOCAL)`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// seedTranslations — 15 English rows
// Q16–Q20 intentionally left without translations (exercises translation:null path).
// Upsert key: @@unique([quoteId, languageCode]).
// ─────────────────────────────────────────────────────────────────────────────
export async function seedTranslations(): Promise<void> {
  const translations = [
    {
      quoteId: Q01,
      languageCode: 'en',
      text:
        'O you who have believed, avoid much [negative] assumption. Indeed, some assumption is sin.' +
        ' And do not spy or backbite each other. Would one of you like to eat the flesh of his brother' +
        ' when dead? You would detest it.',
    },
    {
      quoteId: Q02,
      languageCode: 'en',
      text:
        'O you who have believed, let not a people ridicule [another] people;' +
        ' perhaps they may be better than them; nor let women ridicule [other] women;' +
        ' perhaps they may be better than them.',
    },
    {
      quoteId: Q03,
      languageCode: 'en',
      text:
        'Worship Allah and associate nothing with Him, and to parents do good,' +
        ' and to relatives, orphans, the needy, the near neighbour...',
    },
    {
      quoteId: Q04,
      languageCode: 'en',
      text:
        'And obey Allah and His Messenger, and do not dispute and [thus] lose courage' +
        ' and [then] your strength would depart; and be patient.' +
        ' Indeed, Allah is with the patient.',
    },
    {
      quoteId: Q05,
      languageCode: 'en',
      text: 'O you who have believed, fear Allah and be with those who are true.',
    },
    {
      quoteId: Q06,
      languageCode: 'en',
      text:
        "O you who have believed, when [the adhan] is called for prayer on the day of Jumu'ah," +
        ' then proceed to the remembrance of Allah and leave trade.',
    },
    {
      quoteId: Q07,
      languageCode: 'en',
      text:
        'And they were not commanded except to worship Allah,' +
        ' [being] sincere to Him in religion, inclining to truth.',
    },
    {
      quoteId: Q08,
      languageCode: 'en',
      text:
        'The example of those who spend their wealth in the way of Allah is like a seed' +
        ' which grows seven spikes; in each spike is a hundred grains.' +
        ' And Allah multiplies [His reward] for whom He wills.',
    },
    {
      quoteId: Q09,
      languageCode: 'en',
      text:
        'Do you know what is backbiting? They said: Allah and His Messenger know best.' +
        ' He said: It is your mention of your brother in a way he would dislike.' +
        ' It was said: What if what I say of my brother is true?' +
        ' He said: If it is true, you have backbitten him; if not, you have slandered him.',
    },
    {
      quoteId: Q10,
      languageCode: 'en',
      text: 'Whoever believes in Allah and the Last Day, let him speak good or remain silent.',
    },
    {
      quoteId: Q11,
      languageCode: 'en',
      text:
        'Beware of envy, for indeed envy devours good deeds' +
        ' just as fire devours wood.',
    },
    {
      quoteId: Q12,
      languageCode: 'en',
      text:
        'The five prayers, and one Friday prayer to the next, and one Ramadan to the next,' +
        ' are expiation for whatever [sins] come between them, as long as major sins are avoided.',
    },
    {
      quoteId: Q13,
      languageCode: 'en',
      text:
        'The strong man is not the one who can overpower others in wrestling;' +
        ' the strong man is the one who controls himself when angry.',
    },
    {
      quoteId: Q14,
      languageCode: 'en',
      text:
        'You must be truthful, for truthfulness leads to righteousness and righteousness leads to' +
        ' Paradise. A man keeps speaking the truth and striving to be truthful until he is recorded' +
        ' with Allah as a truthful man.',
    },
    {
      quoteId: Q15,
      languageCode: 'en',
      text:
        'Whoever would like his provision to be expanded and his lifespan to be extended,' +
        ' let him maintain ties of kinship.',
    },
    // Q16–Q20: no translation — exercises the translation:null rendering path
  ];

  for (const t of translations) {
    await prisma.translation.upsert({
      where: { quoteId_languageCode: { quoteId: t.quoteId, languageCode: t.languageCode } },
      create: t,
      update: { text: t.text },
    });
  }
  const withoutCount = 20 - translations.length;
  console.log(
    `translations: ${translations.length} upserted` +
      ` (${withoutCount} quotes without — exercises translation:null path)`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// seedLinks — SinQuote · GoodDeedQuote · QuoteTag
//
// ghibah  → 12 links spanning all 4 QuoteTypes; scores 95,92,88,80,75,70,60,55,40,30,10,0
// namimah → 0 links  (exercises empty-state and curator coverage-gap view)
// hasad   → 1 link with relevanceScore=null  (exercises nulls-last ordering)
// Q01 is linked to BOTH ghibah (SinQuote 95) AND hifz-al-lisan (GoodDeedQuote 80)
// birr-al-walidayn → 0 deed links  (exercises coverage gap on deed side)
// ─────────────────────────────────────────────────────────────────────────────
export async function seedLinks(): Promise<void> {
  // ── SinQuote ────────────────────────────────────────────────────────────
  type SinLink = {
    sinId: string;
    quoteId: string;
    relevanceScore: number | null;
    note: string;
  };

  const sinLinks: SinLink[] = [
    // ghibah — 12 links; all 4 QuoteTypes represented; rubric band examples
    { sinId: SIN_GHIBAH, quoteId: Q01, relevanceScore: 95,   note: 'Al-Hujurat 49:12 — explicit primary prohibition of backbiting; lead with this.' },
    { sinId: SIN_GHIBAH, quoteId: Q02, relevanceScore: 92,   note: 'Al-Hujurat 49:11 — mockery of others; adjacent speech sin, very high relevance.' },
    { sinId: SIN_GHIBAH, quoteId: Q09, relevanceScore: 88,   note: 'Prophetic definition of ghibah — directly answers "what is it?" in plain terms.' },
    { sinId: SIN_GHIBAH, quoteId: Q10, relevanceScore: 80,   note: 'Core speech discipline: good word or silence — names the remedy.' },
    { sinId: SIN_GHIBAH, quoteId: Q17, relevanceScore: 75,   note: 'Ibn al-Qayyim on the predatory tongue — strong supporting scholar voice.' },
    { sinId: SIN_GHIBAH, quoteId: Q19, relevanceScore: 70,   note: 'Madarij definition — useful for onboarding; parallels the hadith definition.' },
    { sinId: SIN_GHIBAH, quoteId: Q20, relevanceScore: 60,   note: "Al-Jawab al-Kafi: anger and speech as shaytan's weapons — supporting framing." },
    { sinId: SIN_GHIBAH, quoteId: Q11, relevanceScore: 55,   note: 'Envy and backbiting share the same root — diminishing the other.' },
    { sinId: SIN_GHIBAH, quoteId: Q05, relevanceScore: 40,   note: 'At-Tawbah 9:119 — general principle: truthfulness as contrast to harmful speech.' },
    { sinId: SIN_GHIBAH, quoteId: Q18, relevanceScore: 30,   note: 'Heart-anger link — peripheral; relevant only when framing ghibah as a heart disease.' },
    { sinId: SIN_GHIBAH, quoteId: Q16, relevanceScore: 10,   note: 'DAIF narration — keep only if library is thin; never lead with this.' },
    { sinId: SIN_GHIBAH, quoteId: Q08, relevanceScore: 0,    note: 'Placeholder — needs review; sadaqah verse is not directly about backbiting.' },
    // namimah — intentionally 0 links (exercises empty-state)
    // kadhib — 2 links
    { sinId: SIN_KADHIB, quoteId: Q05, relevanceScore: 90,   note: 'At-Tawbah 9:119 — command to be with the truthful; direct antidote to lying.' },
    { sinId: SIN_KADHIB, quoteId: Q14, relevanceScore: 80,   note: 'Prophetic chain: truth → righteousness → paradise — the positive frame.' },
    // hasad — 2 links; one with null score (exercises nulls-last ordering)
    { sinId: SIN_HASAD,  quoteId: Q11, relevanceScore: 88,   note: 'Direct warning: envy devours good deeds as fire devours wood.' },
    { sinId: SIN_HASAD,  quoteId: Q03, relevanceScore: null, note: 'Needs review / placeholder — family verse is tangential to envy.' },
    // riya — 2 links
    { sinId: SIN_RIYA,   quoteId: Q07, relevanceScore: 88,   note: 'Al-Bayyinah 98:5 — ikhlas is the direct antidote; frames riya by its opposite.' },
    { sinId: SIN_RIYA,   quoteId: Q16, relevanceScore: 60,   note: 'DAIF riya-as-minor-shirk warning — secondary; label the grade in the UI.' },
    // qat-al-rahim — 2 links
    { sinId: SIN_QAT_AL_RAHIM,  quoteId: Q03, relevanceScore: 92, note: 'An-Nisa 4:36 — direct command to honour relatives.' },
    { sinId: SIN_QAT_AL_RAHIM,  quoteId: Q15, relevanceScore: 85, note: 'Prophetic promise: silat ar-rahim expands provision and life.' },
    // tark-as-salah — 2 links
    { sinId: SIN_TARK_AS_SALAH, quoteId: Q06, relevanceScore: 95, note: "Al-Jumu'ah 62:9 — direct call to rush to prayer; highest relevance." },
    { sinId: SIN_TARK_AS_SALAH, quoteId: Q12, relevanceScore: 88, note: 'The five prayers as expiations — underscores their weight and necessity.' },
    // ghadab — 2 links
    { sinId: SIN_GHADAB, quoteId: Q13, relevanceScore: 90,   note: 'Prophetic definition of real strength — self-control in anger.' },
    { sinId: SIN_GHADAB, quoteId: Q04, relevanceScore: 75,   note: 'Al-Anfal 8:46: patience as the Quranic antidote to anger.' },
  ];

  // ── GoodDeedQuote ────────────────────────────────────────────────────────
  type DeedLink = {
    goodDeedId: string;
    quoteId: string;
    relevanceScore: number;
    note: string;
  };

  const deedLinks: DeedLink[] = [
    // hifz-al-lisan — Q01 bridges ghibah (sin) ↔ hifz-al-lisan (deed)
    { goodDeedId: DEED_HIFZ,        quoteId: Q01, relevanceScore: 80, note: 'The ghibah prohibition doubles as the primary motivation for guarding the tongue.' },
    { goodDeedId: DEED_HIFZ,        quoteId: Q10, relevanceScore: 88, note: '"Say good or be silent" — the most practical formulation of hifz al-lisan.' },
    // sadaqah
    { goodDeedId: DEED_SADAQAH,     quoteId: Q08, relevanceScore: 92, note: 'Al-Baqarah 2:261 — the 700× multiplication verse; lead motivation for sadaqah.' },
    { goodDeedId: DEED_SADAQAH,     quoteId: Q02, relevanceScore: 50, note: 'Peripheral — do not mock the poor; background motivation for giving.' },
    // silat-ar-rahim
    { goodDeedId: DEED_SILAT,       quoteId: Q03, relevanceScore: 90, note: 'An-Nisa 4:36 — explicit command to honour relatives.' },
    { goodDeedId: DEED_SILAT,       quoteId: Q15, relevanceScore: 88, note: 'Prophetic promise: silat ar-rahim brings provision and longevity.' },
    // salat-fi-jamaah
    { goodDeedId: DEED_SALAT_JAM,   quoteId: Q06, relevanceScore: 92, note: "Friday call to prayer — motivates rushing to jama'ah." },
    { goodDeedId: DEED_SALAT_JAM,   quoteId: Q12, relevanceScore: 85, note: 'The prayers as expiations — shows the reward of showing up.' },
    // ikhlas
    { goodDeedId: DEED_IKHLAS,      quoteId: Q07, relevanceScore: 92, note: 'Al-Bayyinah 98:5 — sincerity as the foundation of all worship.' },
    { goodDeedId: DEED_IKHLAS,      quoteId: Q16, relevanceScore: 45, note: 'DAIF riya warning — indirect: avoid the opposite to achieve ikhlas.' },
    // kaff-al-ghadab
    { goodDeedId: DEED_KAFF_GHADAB, quoteId: Q13, relevanceScore: 88, note: 'The strong man controls himself — defines kaff al-ghadab in Prophetic terms.' },
    { goodDeedId: DEED_KAFF_GHADAB, quoteId: Q04, relevanceScore: 78, note: 'Patience in Al-Anfal — the virtue that makes suppressing anger possible.' },
    // dhikr
    { goodDeedId: DEED_DHIKR,       quoteId: Q07, relevanceScore: 80, note: 'Ikhlas verse — sincere worship includes dhikr as its purest form.' },
    { goodDeedId: DEED_DHIKR,       quoteId: Q06, relevanceScore: 68, note: "Jumu'ah call: 'proceed to the dhikr of Allah' — direct mention of dhikr." },
    // birr-al-walidayn — intentionally 0 links (exercises deed coverage-gap view)
  ];

  // ── QuoteTag ─────────────────────────────────────────────────────────────
  type QTagLink = { quoteId: string; tagId: string };

  const qTagLinks: QTagLink[] = [
    { quoteId: Q01, tagId: TAG_TONGUE },
    { quoteId: Q01, tagId: TAG_BACKBITING },
    { quoteId: Q02, tagId: TAG_BACKBITING },
    { quoteId: Q02, tagId: TAG_TONGUE },
    { quoteId: Q03, tagId: TAG_LONELINESS },
    { quoteId: Q04, tagId: TAG_PATIENCE },
    { quoteId: Q04, tagId: TAG_ANGER },
    { quoteId: Q07, tagId: TAG_REMEMBRANCE },
    { quoteId: Q08, tagId: TAG_CHARITY },
    { quoteId: Q09, tagId: TAG_BACKBITING },
    { quoteId: Q10, tagId: TAG_TONGUE },
    { quoteId: Q11, tagId: TAG_ENVY },
    { quoteId: Q12, tagId: TAG_HEREAFTER },
    { quoteId: Q13, tagId: TAG_ANGER },
    { quoteId: Q14, tagId: TAG_FORGIVENESS },
    { quoteId: Q17, tagId: TAG_TONGUE },
    { quoteId: Q18, tagId: TAG_ANGER },
    { quoteId: Q18, tagId: TAG_DESPAIR },
  ];

  for (const link of sinLinks) {
    await prisma.sinQuote.upsert({
      where: { sinId_quoteId: { sinId: link.sinId, quoteId: link.quoteId } },
      create: { ...link, reviewStatus: LinkReviewStatus.ACCEPTED },
      update: {
        relevanceScore: link.relevanceScore,
        note: link.note,
        reviewStatus: LinkReviewStatus.ACCEPTED,
      },
    });
  }

  for (const link of deedLinks) {
    await prisma.goodDeedQuote.upsert({
      where: { goodDeedId_quoteId: { goodDeedId: link.goodDeedId, quoteId: link.quoteId } },
      create: { ...link, reviewStatus: LinkReviewStatus.ACCEPTED },
      update: {
        relevanceScore: link.relevanceScore,
        note: link.note,
        reviewStatus: LinkReviewStatus.ACCEPTED,
      },
    });
  }

  for (const link of qTagLinks) {
    await prisma.quoteTag.upsert({
      where: { quoteId_tagId: { quoteId: link.quoteId, tagId: link.tagId } },
      create: link,
      update: {},
    });
  }

  const total = sinLinks.length + deedLinks.length;
  console.log(
    `links: ${sinLinks.length} SinQuote + ${deedLinks.length} GoodDeedQuote = ${total} total` +
      ` | ${qTagLinks.length} QuoteTag`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// seedUsers — 2 rows
// Phase 4: passwordHash added via add_auth_fields migration.
// Dev password for both users: password123456  (10+ chars, satisfies RegisterDto)
// argon2id OWASP baseline — same params as AuthService.
// ─────────────────────────────────────────────────────────────────────────────
export async function seedUsers(): Promise<void> {
  const DEV_PASSWORD = 'password123456';
  const passwordHash = await argon2hash(DEV_PASSWORD, {
    type: argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const users = [
    {
      id: U_USER,
      email: 'user@thekra.local',
      displayName: 'Thekra User',
      passwordHash,
      role: UserRole.USER,
    },
    {
      id: U_ADMIN,
      email: 'admin@thekra.local',
      displayName: 'Thekra Admin',
      passwordHash,
      role: UserRole.ADMIN,
    },
  ];

  for (const user of users) {
    const { id, ...fields } = user;
    await prisma.user.upsert({
      where: { email: user.email },
      create: { id, ...fields },
      update: { passwordHash: fields.passwordHash, role: fields.role },
    });
  }
  console.log(
    `users: ${users.length} upserted (dev password: ${DEV_PASSWORD}, roles: USER + ADMIN)`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// seedFavorites — 3 rows for user@thekra.local
// ─────────────────────────────────────────────────────────────────────────────
export async function seedFavorites(): Promise<void> {
  const favorites = [
    { userId: U_USER, quoteId: Q01 }, // Al-Hujurat 49:12
    { userId: U_USER, quoteId: Q09 }, // ghibah hadith
    { userId: U_USER, quoteId: Q13 }, // anger control
  ];

  for (const fav of favorites) {
    await prisma.favorite.upsert({
      where: { userId_quoteId: { userId: fav.userId, quoteId: fav.quoteId } },
      create: fav,
      update: {},
    });
  }
  console.log(`favorites: ${favorites.length} upserted for user@thekra.local`);
}

// ─────────────────────────────────────────────────────────────────────────────
// seedSyncLogs — 3 rows against Quran.com API source
//   SL01  SUCCESS  (1 week ago)   — clean run
//   SL02  FAILED   (2 days ago)   — auth error, realistic errorMessage
//   SL03  RUNNING  (3 hours ago)  — stale; exercises §3.3 reconciliation logic
// ─────────────────────────────────────────────────────────────────────────────
export async function seedSyncLogs(): Promise<void> {
  const now = new Date();
  const msPerHour = 60 * 60 * 1000;
  const oneWeekAgo   = new Date(now.getTime() - 7 * 24 * msPerHour);
  const twoDaysAgo   = new Date(now.getTime() - 2 * 24 * msPerHour);
  const threeHrsAgo  = new Date(now.getTime() - 3 * msPerHour);

  const syncLogs = [
    {
      id: SL01,
      sourceId: SRC_QURAN_COM,
      status: SyncStatus.SUCCESS,
      startedAt: oneWeekAgo,
      finishedAt: new Date(oneWeekAgo.getTime() + 8 * 60 * 1000), // 8-min run
      recordsImported: 1182,
      errorMessage: null,
    },
    {
      id: SL02,
      sourceId: SRC_QURAN_COM,
      status: SyncStatus.FAILED,
      startedAt: twoDaysAgo,
      finishedAt: new Date(twoDaysAgo.getTime() + 45 * 1000), // failed after 45 s
      recordsImported: 0,
      errorMessage:
        'HTTP 403 Forbidden — QURAN_API_TOKEN missing or expired;' +
        ' configure QURAN_API_TOKEN and retry.',
    },
    {
      // Stale RUNNING — startup reconciliation should mark this FAILED.
      id: SL03,
      sourceId: SRC_QURAN_COM,
      status: SyncStatus.RUNNING,
      startedAt: threeHrsAgo,
      finishedAt: null,
      recordsImported: 0,
      errorMessage: null,
    },
  ];

  for (const log of syncLogs) {
    const { id, ...fields } = log;
    await prisma.syncLog.upsert({
      where: { id },
      create: { id, ...fields },
      update: fields,
    });
  }
  console.log(
    `sync logs: ${syncLogs.length} upserted (SUCCESS · FAILED · RUNNING/stale)`,
  );
}

// ── Default export / main ────────────────────────────────────────────────────

export default async function main(): Promise<void> {
  console.log('🌱  Seeding Thekra development database…\n');
  await seedSources();
  await seedTags();
  await seedSins();
  await seedGoodDeeds();
  await seedQuotes();
  await seedTranslations();
  await seedLinks();
  await seedUsers();
  await seedFavorites();
  await seedSyncLogs();
  console.log('\n✅  Seed complete.');
}

// Run when executed directly (node prisma/seed.ts or tsx prisma/seed.ts).
// When imported by e2e helpers, process.argv[1] differs so main() is NOT called.
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main()
    .catch((e: unknown) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
