/**
 * The Arabic name of a city the member typed in Latin letters (owner round 6, C-03a: «اسم المدينة بالعربية»). The
 * prayer-times lookup keeps whatever the member typed (AlAdhan geocodes it); the Arabic settings page shows a known
 * Arabic name when the city is in this short list of well-known names, otherwise the city as typed. Pure.
 */
const AR_NAMES: Readonly<Record<string, string>> = {
  amman: 'عمّان',
  irbid: 'إربد',
  zarqa: 'الزرقاء',
  aqaba: 'العقبة',
  jerusalem: 'القدس',
  'al quds': 'القدس',
  gaza: 'غزة',
  nablus: 'نابلس',
  hebron: 'الخليل',
  ramallah: 'رام الله',
  damascus: 'دمشق',
  aleppo: 'حلب',
  homs: 'حمص',
  beirut: 'بيروت',
  tripoli: 'طرابلس',
  baghdad: 'بغداد',
  basra: 'البصرة',
  mosul: 'الموصل',
  erbil: 'أربيل',
  riyadh: 'الرياض',
  jeddah: 'جدة',
  mecca: 'مكة المكرمة',
  makkah: 'مكة المكرمة',
  medina: 'المدينة المنورة',
  madinah: 'المدينة المنورة',
  dammam: 'الدمام',
  taif: 'الطائف',
  kuwait: 'الكويت',
  'kuwait city': 'مدينة الكويت',
  doha: 'الدوحة',
  manama: 'المنامة',
  dubai: 'دبي',
  'abu dhabi': 'أبوظبي',
  sharjah: 'الشارقة',
  muscat: 'مسقط',
  sanaa: 'صنعاء',
  "sana'a": 'صنعاء',
  aden: 'عدن',
  cairo: 'القاهرة',
  alexandria: 'الإسكندرية',
  giza: 'الجيزة',
  khartoum: 'الخرطوم',
  tunis: 'تونس',
  algiers: 'الجزائر',
  rabat: 'الرباط',
  casablanca: 'الدار البيضاء',
  marrakesh: 'مراكش',
  fes: 'فاس',
  nouakchott: 'نواكشوط',
  istanbul: 'إسطنبول',
  ankara: 'أنقرة',
  london: 'لندن',
  paris: 'باريس',
  berlin: 'برلين',
  'new york': 'نيويورك',
  toronto: 'تورنتو',
  kuala_lumpur: 'كوالالمبور',
  'kuala lumpur': 'كوالالمبور',
  jakarta: 'جاكرتا',
};

/** The city as the page language shows it: a known Arabic name on an Arabic page, else the city as typed. */
export function cityDisplayName(city: string, locale: 'ar' | 'en'): string {
  if (locale !== 'ar' || /[؀-ۿ]/.test(city)) return city;
  const key = city.trim().toLowerCase().replace(/\s+/g, ' ').replace(/,.*$/, '');
  return AR_NAMES[key] ?? city;
}
