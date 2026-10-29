/**
 * The note of a topic link («لماذا هذا الحديث؟»), ported rule for rule from the website
 * (frontend/src/lib/format/link-note.ts and the parts of provenance.ts it uses); change a rule there first, then here.
 * Only public attribution notes reach the reader («أورده…», «ذكره…», «من باب: …», «من كتاب …»); curator relevance
 * notes never do. In English the attribution is rendered in English and untranslated chapter titles are dropped.
 * One difference from the site: parts are joined with « · » instead of a dash (the app's separator).
 */

const SEPARATOR = ' · ';

const BOOKS: ReadonlyArray<[RegExp, string]> = [
  [/صحيح الترغيب والترهيب/g, 'Sahih al-Targhib wa al-Tarhib'],
  [/الجامع لشعب الإيمان(?:\s*\([^)]*\))?/g, "Shu'ab al-Iman"],
  [/الزهد والرقائق/g, "Al-Zuhd wa al-Raqa'iq"],
  [/رياض الصالحين(?:\s*\([^)]*\))?/g, 'Riyad al-Salihin'],
  [/سلسلة أعمال القلوب/g, "Silsilat A'mal al-Qulub"],
  [/أعمال القلوب/g, "A'mal al-Qulub"],
  [/مختصر منهاج القاصدين/g, 'Mukhtasar Minhaj al-Qasidin'],
  [/صحيح البخاري/g, 'Sahih al-Bukhari'],
  [/صحيح مسلم/g, 'Sahih Muslim'],
  [/الأدب المفرد/g, 'Al-Adab al-Mufrad'],
  [/تفسير السعدي/g, "Tafsir al-Sa'di"],
  [/التحرير والتنوير/g, 'Al-Tahrir wa al-Tanwir'],
  [/القرآن الكريم/g, "The Noble Qur'an"],
  [/شرح حديث يتبع الميت ثلاثة/g, 'The Three that Follow the Dead'],
  [/استنشاق نسيم الأنس/g, 'Istinshaq Nasim al-Uns'],
  [/المحجة في سير الدلجة/g, 'Al-Mahajjah fi Sayr al-Duljah'],
  [/اختيار الأولى/g, 'Ikhtiyar al-Ula'],
  [/التخويف من النار/g, 'Al-Takhweef min al-Nar'],
  [/أهوال القبور/g, 'Ahwal al-Qubur'],
  [/لطائف المعارف/g, "Lata'if al-Ma'arif"],
  [/ذم الخمر/g, 'Dhamm al-Khamr'],
  [/الكبائر للذهبي/g, 'Al-Kabair by al-Dhahabi'],
  [/الكبائر/g, 'Al-Kabair'],
];

const PEOPLE: ReadonlyArray<[RegExp, string]> = [
  [/بشّار عواد معروف/g, "Bashar Awad Ma'ruf"],
  [/بشار عواد معروف/g, "Bashar Awad Ma'ruf"],
  [/شعيب الأرنؤوط/g, "Shu'ayb al-Arna'ut"],
  [/ابن رجب الحنبلي/g, 'Ibn Rajab'],
  [/الشيخ محمد صالح المنجد/g, 'Shaykh Muhammad Salih al-Munajjid'],
  [/محمد صالح المنجد/g, 'Muhammad Salih al-Munajjid'],
  [/المنذري/g, 'al-Mundhiri'],
  [/ابن المبارك/g, 'Ibn al-Mubarak'],
  [/الذهبي/g, 'al-Dhahabi'],
  [/النووي/g, 'al-Nawawi'],
  [/ابن كثير/g, 'Ibn Kathir'],
  [/السعدي/g, "al-Sa'di"],
];

const PHRASES: ReadonlyArray<[RegExp, string]> = [
  [/متفق عليه/g, 'Agreed upon'],
  [/رواه البخاري/g, 'Narrated by al-Bukhari'],
  [/رواه مسلم/g, 'Narrated by Muslim'],
  [/مسند أحمد\s*\(ط\.\s*قرطبة\)/g, 'Musnad Ahmad (Qurtuba ed.)'],
  [/مسند أحمد/g, 'Musnad Ahmad'],
  [/صحيح ابن حبان/g, 'Sahih Ibn Hibban'],
  [/سنن أبي داود/g, 'Sunan Abi Dawud'],
  [/سنن الترمذي/g, "Jami' al-Tirmidhi"],
  [/سنن ابن ماجه/g, 'Sunan Ibn Majah'],
  [/سنن النسائي/g, "Sunan al-Nasa'i"],
  [/تصنيف آلي حسب محتوى النص/g, 'Auto-classified by text content'],
  [/الكبيرة التاسعة عشر شرب الخمر/g, 'the nineteenth major sin: drinking wine'],
  [/الكبيرة\s*/g, 'major sin '],
  [/من كتاب\s*/g, 'From '],
  [/البخاري/g, 'al-Bukhari'],
  [/مسلم/g, 'Muslim'],
  [/،\s*ص\s*/g, ', p. '],
  [/ص\s+(\d+)/g, 'p. $1'],
  [/،\s*رقم\s*/g, ', no. '],
  [/رقم\s*/g, 'no. '],
  [/،/g, ', '],
];

/** A dash between two parts of a stored note («باب — كتاب»). */
const DASH_PARTS = /\s+[—–]\s+/g;

function applyAll(text: string, table: ReadonlyArray<[RegExp, string]>): string {
  let next = text;
  for (const [pattern, replacement] of table) next = next.replace(pattern, replacement);
  return next;
}

function englishBookTail(arabicBook: string): string {
  return applyAll(arabicBook.trim(), BOOKS).replace(/\s+/g, ' ').trim();
}

function englishProvenance(text: string): string {
  return applyAll(applyAll(applyAll(text, PEOPLE), BOOKS), PHRASES).replace(/\s+/g, ' ').trim();
}

function englishLinkNote(text: string): string {
  let match = text.match(/^أورده\s+(.+?)\s+في\s+باب\s*:\s*.+?\s*[—–-]\s*(.+)$/);
  if (match?.[1] && match[2]) return `Cited by ${applyAll(match[1], PEOPLE)}${SEPARATOR}${englishBookTail(match[2])}`;

  match = text.match(/^ذكره\s+(.+?)\s+في\s+(.+?)(?:،\s*ص\s*(\d+))?$/);
  if (match?.[1] && match[2]) {
    const page = match[3] ? `, p. ${match[3]}` : '';
    return `Mentioned by ${applyAll(match[1], PEOPLE)} in ${englishBookTail(match[2])}${page}`;
  }

  match = text.match(/^(?:من باب|تصنيف المراجع حسب موضوع الباب|اقتراح من عنوان الباب)\s*:\s*.+?\s*[—–-]\s*(.+)$/);
  if (match?.[1]) return `From ${englishBookTail(match[1])}`;

  match = text.match(/^من كتاب\s+(.+)$/);
  if (match?.[1]) return `From ${englishBookTail(match[1])}`;

  return englishProvenance(text).replace(DASH_PARTS, SEPARATOR);
}

/** The note the reader may see, or null for an editorial note (the website's `publicLinkNote`). */
export function publicLinkNote(note: string | null | undefined, locale: 'ar' | 'en'): string | null {
  if (!note) return null;
  const text = note.replace(/\s+/g, ' ').trim();
  const attributed =
    /^أورده\s+/.test(text) ||
    /^ذكره\s+/.test(text) ||
    /^(?:من باب|تصنيف المراجع حسب موضوع الباب|اقتراح من عنوان الباب)\s*:/.test(text) ||
    /^من كتاب\s+/.test(text);
  if (!attributed) return null;
  if (locale === 'en') return englishLinkNote(text);
  return text.replace(DASH_PARTS, SEPARATOR);
}
