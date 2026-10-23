/** Display-only English for stored Arabic citations and link notes. The database stays Arabic. */

const BOOKS: ReadonlyArray<[RegExp, string]> = [
  [/صحيح الترغيب والترهيب/g, "Sahih al-Targhib wa al-Tarhib"],
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
  [/الكبائر للذهبي/g, "Al-Kabair by al-Dhahabi"],
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

function applyAll(text: string, table: ReadonlyArray<[RegExp, string]>): string {
  let next = text;
  for (const [pattern, replacement] of table) next = next.replace(pattern, replacement);
  return next;
}

function englishBookTail(arabicBook: string): string {
  return applyAll(arabicBook.trim(), BOOKS).replace(/\s+/g, ' ').trim();
}

/**
 * Link notes are free Arabic sentences. English UI keeps the attribution
 * (who / which book) and drops untranslated chapter titles so the footer
 * does not stay half Arabic.
 */
export function englishLinkNote(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.replace(/\s+/g, ' ').trim();

  let match = text.match(/^أورده\s+(.+?)\s+في\s+باب\s*:\s*.+?\s*[—–-]\s*(.+)$/);
  if (match?.[1] && match[2]) {
    return `Cited by ${applyAll(match[1], PEOPLE)} — ${englishBookTail(match[2])}`;
  }

  match = text.match(/^ذكره\s+(.+?)\s+في\s+(.+?)(?:،\s*ص\s*(\d+))?$/);
  if (match?.[1] && match[2]) {
    const page = match[3] ? `, p. ${match[3]}` : '';
    return `Mentioned by ${applyAll(match[1], PEOPLE)} in ${englishBookTail(match[2])}${page}`;
  }

  match = text.match(/^(?:من باب|تصنيف المراجع حسب موضوع الباب|اقتراح من عنوان الباب)\s*:\s*.+?\s*[—–-]\s*(.+)$/);
  if (match?.[1]) return `From ${englishBookTail(match[1])}`;

  match = text.match(/^من كتاب\s+(.+)$/);
  if (match?.[1]) return `From ${englishBookTail(match[1])}`;

  if (text === 'تصنيف آلي حسب محتوى النص') return 'Auto-classified by text content';

  return englishProvenance(text);
}

const ARABIC_SCRIPT = /[\u0600-\u06FF]/;

/**
 * English UI only: `englishProvenance`, keeping the « — »-separated parts that came out fully
 * English and dropping any part still in Arabic. Null when nothing English is left, so the
 * caller hides the line instead of showing half-translated prose.
 */
export function englishOnlyProvenance(value: string | null | undefined): string | null {
  const english = englishProvenance(value);
  if (!english) return null;
  const parts = english
    .split(/\s+[—–]\s+/)
    .map((part) => part.trim())
    .filter((part) => part && !ARABIC_SCRIPT.test(part));
  return parts.length > 0 ? parts.join(' — ') : null;
}

export function englishProvenance(value: string | null | undefined): string | null {
  if (!value) return null;
  let text = value;
  text = applyAll(text, PEOPLE);
  text = applyAll(text, BOOKS);
  text = applyAll(text, PHRASES);
  return text.replace(/\s+/g, ' ').trim();
}
