/**
 * Owner-approved works as bibliographic config only.
 * No book text is stored here.
 *
 * OpenITI CC BY-NC-SA 4.0 is accepted. Corpus files, when downloaded, stay
 * outside git and are pinned by commit SHA. The app must show that attribution.
 *
 * Grades are per narration, never per book. Al-Adab al-Mufrad contains weak
 * reports; al-Albani split them into Sahih al-Adab al-Mufrad and Da'if
 * al-Adab al-Mufrad (OpenITI 1420MuhammadNasirDinAlbani). An importer may set
 * Quote.grade only from membership in those works, and must store who graded
 * it (gradeAuthority / gradeReference).
 */
import { SourceType } from '@prisma/client';

export const APPROVED_WORKS = [
  {
    id: '10000000-0000-4000-8000-000000000006',
    bookKey: 'book:adab-al-mufrad',
    name: 'Al-Adab al-Mufrad',
    nameAr: 'الأدب المفرد',
    type: SourceType.HADITH_COLLECTION,
    author: 'Muhammad ibn Ismaʿil al-Bukhari',
    authorAr: 'محمد بن إسماعيل البخاري',
    role: 'narration',
    /** Never a whole-book grade. Grade each narration from al-Albani's split. */
    gradeBy: 'albani-adab-split' as const,
  },
  {
    id: '10000000-0000-4000-8000-000000000007',
    bookKey: 'book:dhahabi-kabair',
    name: 'Al-Kabair',
    nameAr: 'الكبائر',
    type: SourceType.BOOK,
    author: 'Shams al-Din al-Dhahabi',
    authorAr: 'شمس الدين الذهبي',
    role: 'sin-rank',
    /** Rank source for كبيرة. A sin absent from this book stays rank = null. */
    gradeBy: null,
  },
  {
    id: '10000000-0000-4000-8000-000000000008',
    bookKey: 'book:mundhiri-targhib',
    name: "Sahih al-Targhib wa al-Tarhib (Maktabat al-Ma'arif)",
    nameAr: 'صحيح الترغيب والترهيب',
    type: SourceType.HADITH_COLLECTION,
    author: 'Abd al-Azim al-Mundhiri',
    authorAr: 'عبد العظيم المنذري',
    role: 'related-narration',
    /**
     * Ma'arif edition (al-Albani). Grade each narration from his margin word
     * (صحيح / حسن / صحيح لغيره / حسن لغيره). Never a whole-book grade.
     */
    gradeBy: null,
  },
  {
    id: '10000000-0000-4000-8000-000000000010',
    bookKey: 'book:shuab-iman',
    name: "Al-Jami' li-Shu'ab al-Iman (al-Rushd ed.)",
    nameAr: 'الجامع لشعب الإيمان (ط الرشد)',
    type: SourceType.HADITH_COLLECTION,
    author: 'Ahmad ibn al-Husayn al-Bayhaqi',
    authorAr: 'البيهقي',
    role: 'narration',
    /** Ungraded collection: narrations import as UNGRADED until a curator grades them. */
    gradeBy: null,
  },
  {
    id: '10000000-0000-4000-8000-000000000009',
    bookKey: 'book:nawawi-riyad',
    name: 'Riyad al-Salihin (Halabi)',
    nameAr: 'رياض الصالحين',
    type: SourceType.HADITH_COLLECTION,
    author: 'Yahya ibn Sharaf al-Nawawi',
    authorAr: 'يحيى بن شرف النووي',
    role: 'related-narration',
    /**
     * Halabi edition. Only «متفق عليه» / «رواه البخاري» / «رواه مسلم» become
     * SAHIH, with gradeAuthority «الصحيحان». Every other takhrij stays UNGRADED.
     */
    gradeBy: null,
  },
  {
    id: '10000000-0000-4000-8000-000000000011',
    bookKey: 'book:ibn-mubarak-zuhd',
    name: "Al-Zuhd wa al-Raqa'iq (Dar al-Mi'raj)",
    nameAr: 'الزهد والرقائق',
    type: SourceType.HADITH_COLLECTION,
    author: "Abd Allah ibn al-Mubarak",
    authorAr: 'عبد الله بن المبارك',
    role: 'narration',
    /** Narrations stay UNGRADED. No chapter links. */
    gradeBy: null,
  },
  {
    id: '10000000-0000-4000-8000-000000000013',
    bookKey: 'book:sadi-tafsir',
    name: "Taysir al-Karim al-Rahman (al-Sa'di)",
    nameAr: 'تفسير السعدي',
    type: SourceType.BOOK,
    author: "Abd al-Rahman al-Sa'di",
    authorAr: 'عبد الرحمن السعدي',
    role: 'tafsir',
    /**
     * Arabic: Quran.com tafsir resource 91.
     * English: tafsirs.org / IIPH 2018 (Nasiruddin al-Khattab). Import: `sadi-en`.
     * The owner checks both providers' redistribution terms.
     */
    gradeBy: null,
  },
  {
    id: '10000000-0000-4000-8000-000000000014',
    bookKey: 'book:ibn-ashur-tahrir',
    name: 'Al-Tahrir wa al-Tanwir',
    nameAr: 'التحرير والتنوير',
    type: SourceType.BOOK,
    author: 'Muhammad al-Tahir ibn Ashur',
    authorAr: 'محمد الطاهر بن عاشور',
    role: 'tafsir',
    /** Arabic only in corpus. No free English edition found for import. */
    gradeBy: null,
  },
  {
    id: '10000000-0000-4000-8000-000000000024',
    bookKey: 'book:ibn-kathir-en',
    name: 'Ibn Kathir (Abridged)',
    nameAr: 'تفسير ابن كثير (مختصر)',
    type: SourceType.BOOK,
    author: 'Hafiz Ibn Kathir',
    authorAr: 'الحافظ ابن كثير',
    role: 'tafsir',
    /** Quran.com English resource 169. Interim only; English UI prefers Sa'di when present. */
    gradeBy: null,
  },
  {
    id: '10000000-0000-4000-8000-000000000012',
    bookKey: 'book:ibn-qudama-minhaj',
    name: 'Mukhtasar Minhaj al-Qasidin',
    nameAr: 'مختصر منهاج القاصدين',
    type: SourceType.BOOK,
    author: 'Ahmad ibn Qudama al-Maqdisi',
    authorAr: 'أحمد بن قدامة المقدسي',
    role: 'source-only',
    /** Prose. The importer records the Source and the file, not quotes. */
    gradeBy: null,
  },
  {
    id: '10000000-0000-4000-8000-000000000015',
    bookKey: 'book:munajjid-qulub',
    name: 'Silsilat A\'mal al-Qulub',
    nameAr: 'سلسلة أعمال القلوب',
    type: SourceType.BOOK,
    author: 'Muhammad Salih al-Munajjid',
    authorAr: 'محمد صالح المنجد',
    role: 'citation-only',
    /** Copyrighted. The importer stores citations and a page attribution, never his prose. */
    gradeBy: null,
  },
] as const;
