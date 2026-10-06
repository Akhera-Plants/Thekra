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
    name: 'Al-Targhib wa al-Tarhib',
    nameAr: 'الترغيب والترهيب',
    type: SourceType.HADITH_COLLECTION,
    author: 'Abd al-Azim al-Mundhiri',
    authorAr: 'عبد العظيم المنذري',
    role: 'related-narration',
    /** Grades come from a named grader per narration, not from the book title. */
    gradeBy: null,
  },
  {
    id: '10000000-0000-4000-8000-000000000009',
    bookKey: 'book:nawawi-riyad',
    name: 'Riyad al-Salihin',
    nameAr: 'رياض الصالحين',
    type: SourceType.HADITH_COLLECTION,
    author: 'Yahya ibn Sharaf al-Nawawi',
    authorAr: 'يحيى بن شرف النووي',
    role: 'related-narration',
    /** Nawawi's takhrij notes are not auto-mapped to a grade. */
    gradeBy: null,
  },
] as const;
