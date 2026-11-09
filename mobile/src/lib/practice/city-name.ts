/**
 * The prayer-times city in the UI language (owner round 6, C-03a: «اسم المدينة بالعربية»). The member types the city
 * as he likes (AlAdhan geocodes it, practice-core `PrayerSettings.city`), so an Arabic screen could show «Amman». The
 * stored value never changes; only its display does, and only for names whose Arabic and English forms are certain
 * (the capitals and big cities of the region and a few others). Anything else is shown as typed: no invented
 * translation. Pure.
 */

/** [Arabic, English, other spellings…]. Matched without case, accents, hyphens or a leading «al-». */
const CITIES: readonly (readonly string[])[] = [
  ['عمّان', 'Amman', 'عمان'],
  ['إربد', 'Irbid', 'اربد'],
  ['الزرقاء', 'Zarqa', 'Az Zarqa'],
  ['العقبة', 'Aqaba'],
  ['السلط', 'Salt', 'As Salt'],
  ['القدس', 'Jerusalem', 'Al Quds'],
  ['غزة', 'Gaza'],
  ['نابلس', 'Nablus'],
  ['الخليل', 'Hebron'],
  ['رام الله', 'Ramallah'],
  ['جنين', 'Jenin'],
  ['دمشق', 'Damascus'],
  ['حلب', 'Aleppo'],
  ['حمص', 'Homs'],
  ['بيروت', 'Beirut'],
  ['طرابلس', 'Tripoli'],
  ['بغداد', 'Baghdad'],
  ['البصرة', 'Basra'],
  ['الموصل', 'Mosul'],
  ['أربيل', 'Erbil'],
  ['الرياض', 'Riyadh'],
  ['جدة', 'Jeddah', 'Jiddah', 'Jedda'],
  ['مكة المكرمة', 'Makkah', 'Mecca', 'Makka', 'مكة'],
  ['المدينة المنورة', 'Madinah', 'Medina', 'Madina', 'المدينة'],
  ['الدمام', 'Dammam'],
  ['الطائف', 'Taif'],
  ['تبوك', 'Tabuk'],
  ['أبها', 'Abha'],
  ['الكويت', 'Kuwait', 'Kuwait City'],
  ['الدوحة', 'Doha'],
  ['المنامة', 'Manama'],
  ['أبوظبي', 'Abu Dhabi', 'أبو ظبي'],
  ['دبي', 'Dubai'],
  ['الشارقة', 'Sharjah'],
  ['مسقط', 'Muscat'],
  ['صنعاء', 'Sanaa', "Sana'a"],
  ['عدن', 'Aden'],
  ['القاهرة', 'Cairo'],
  ['الإسكندرية', 'Alexandria'],
  ['الخرطوم', 'Khartoum'],
  ['تونس', 'Tunis'],
  ['الجزائر', 'Algiers'],
  ['الرباط', 'Rabat'],
  ['الدار البيضاء', 'Casablanca'],
  ['مراكش', 'Marrakesh', 'Marrakech'],
  ['فاس', 'Fes', 'Fez'],
  ['نواكشوط', 'Nouakchott'],
  ['إسطنبول', 'Istanbul'],
  ['أنقرة', 'Ankara'],
  ['لندن', 'London'],
  ['باريس', 'Paris'],
  ['برلين', 'Berlin'],
  ['نيويورك', 'New York'],
  ['تورنتو', 'Toronto'],
  ['كوالالمبور', 'Kuala Lumpur'],
  ['جاكرتا', 'Jakarta'],
];

function key(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ًͯ-ْ]/g, '')
    .toLowerCase()
    .replace(/^(al|el|ad|ar|as|az|at|an)[\s-]+/, '')
    .replace(/[\s'’-]+/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة$/, 'ه');
}

const INDEX = new Map<string, readonly string[]>();
for (const names of CITIES) for (const n of names) INDEX.set(key(n), names);

/** The city's name in `lang` when it is known with certainty, else the name as the member typed it. */
export function cityLabel(city: string, lang: 'ar' | 'en'): string {
  const trimmed = city.trim();
  // An older setting may carry the country after a comma («Amman, JO»): the city part is looked up and shown.
  const names = INDEX.get(key(trimmed.split(',')[0] ?? ''));
  if (!names) return trimmed;
  return lang === 'ar' ? names[0]! : names[1]!;
}
