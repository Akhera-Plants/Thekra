/**
 * Arabic book titles for Ibn Abi al-Dunya works (reviewer-facing Source.nameAr).
 * Keys match OpenITI short names under 0281IbnAbiDunya.<Key>.
 */
export const DUNYA_TITLES_AR: Record<string, string> = {
  Ahwal: 'الأهوال',
  AmrBiMacruf: 'الأمر بالمعروف',
  Awliya: 'الأولياء',
  CaqlWaFadluh: 'العقل وفضله',
  Ciyal: 'العيال',
  CumrWaShayb: 'العمر والشيب',
  Cuqubat: 'العقوبات',
  Cuzla: 'العزلة',
  DhammBaghy: 'ذم البغي',
  DhammDunya: 'ذم الدنيا',
  DhammGhiba: 'ذم الغيبة والنميمة',
  DhammMalahi: 'ذم الملاهي',
  DhammMuskir: 'ذم المسكر',
  DhikrMawt: 'ذكر الموت',
  FadailRamadan: 'فضائل رمضان',
  FadlCashrDhiHijja: 'فضل عشر ذي الحجة',
  FarajBacdaShidda: 'الفرج بعد الشدة',
  HammWaHuzn: 'الهم والحزن',
  Hawatif: 'الهواتف',
  Hilm: 'الحلم',
  HilmMucawiya: 'حلم معاوية',
  HusnZannBiLlah: 'حسن الظن بالله',
  IctibarWaAcqab: 'الاعتبار وأعقاب السرور والأحزان',
  IkhlasWaNiyya: 'الإخلاص والنية',
  Ikhwan: 'الإخوان',
  IshrafFiManazil: 'الشرف في المنازل',
  IslahMal: 'إصلاح المال',
  IstinacMacruf: 'اصطناع المعروف',
  Juc: 'الجوع',
  KalamLayali: 'كلام الليالي والأيام',
  MakaidShaytan: 'مكائد الشيطان',
  MakarimAkhlaq: 'مكارم الأخلاق',
  ManCashaBacdaMawt: 'من عاش بعد الموت',
  Manamat: 'المنامات',
  MaqtalCali: 'مقتل علي',
  MaradWaKaffarat: 'المرض والكفارات',
  MatarWaRacd: 'المطر والرعد والبرق',
  MudaratNas: 'مداراة الناس',
  MuhasabatNafs: 'محاسبة النفس',
  Muhtadarin: 'المحتضرين',
  MujabuDacwa: 'مجابو الدعوة',
  Mutamannin: 'المتمنين',
  QadaHawaij: 'قضاء الحوائج',
  Qanaca: 'القناعة',
  QasrAmal: 'قصر الأمل',
  QiraDayf: 'قرى الضيف',
  Qubur: 'القبور',
  RasailFiTawakkul: 'رسائل في التوكل',
  Rida: 'الرضا',
  RiqqaWaBuka: 'الرقة والبكاء',
  Sabr: 'الصبر',
  Samt: 'الصمت وآداب اللسان',
  Shukr: 'الشكر',
  SifatJanna: 'صفة الجنة',
  SifatNar: 'صفة النار',
  Tahajjud: 'التهجد وقيام الليل',
  TawaducWaKhumul: 'التواضع والخمول',
  Tawakkul: 'التوكل',
  Tawba: 'التوبة',
  Wajal: 'الوجل',
  Warac: 'الورع',
  Yaqin: 'اليقين',
  Zuhd: 'الزهد',
};

export function titleArFor(key: string): string {
  return DUNYA_TITLES_AR[key] ?? key;
}

/**
 * English Source.name (shown on the English site), derived from DUNYA_TITLES_AR:
 * the transliterated title, then its meaning in parentheses.
 *
 * Style (matches approved-works.ts): ʿayn and hamza are both «'», no macrons,
 * «al-» is never assimilated (al-Samt, not as-Samt), «wa» joins pairs. A title
 * that is one bare noun reads «Kitab al-…»; a longer title is transliterated as
 * printed in Arabic.
 *
 * IshrafFiManazil is deliberately absent: its nameAr («الشرف في المنازل») does
 * not match the corpus title («الإشراف في منازل الأشراف»), so the right title is
 * for the owner to settle. It keeps the key-derived fallback until then.
 */
export const DUNYA_TITLES_EN: Record<string, string> = {
  Ahwal: 'Kitab al-Ahwal (The Terrors)',
  AmrBiMacruf: "Al-Amr bi-l-Ma'ruf (Enjoining What Is Right)",
  Awliya: "Kitab al-Awliya' (The Friends of God)",
  CaqlWaFadluh: "Al-'Aql wa Fadluh (Reason and Its Merit)",
  Ciyal: "Kitab al-'Iyal (Dependants)",
  CumrWaShayb: "Al-'Umr wa al-Shayb (Lifespan and Old Age)",
  Cuqubat: "Kitab al-'Uqubat (Punishments)",
  Cuzla: "Kitab al-'Uzla (Seclusion)",
  DhammBaghy: 'Dhamm al-Baghy (Censure of Transgression)',
  DhammDunya: 'Dhamm al-Dunya (Censure of the World)',
  DhammGhiba: 'Dhamm al-Ghiba wa al-Namima (Censure of Backbiting and Talebearing)',
  DhammMalahi: 'Dhamm al-Malahi (Censure of Idle Amusements)',
  DhammMuskir: 'Dhamm al-Muskir (Censure of Intoxicants)',
  DhikrMawt: 'Dhikr al-Mawt (Remembrance of Death)',
  FadailRamadan: "Fada'il Ramadan (The Virtues of Ramadan)",
  FadlCashrDhiHijja: "Fadl 'Ashr Dhi al-Hijja (The Merit of the Ten Days of Dhu al-Hijja)",
  FarajBacdaShidda: "Al-Faraj ba'd al-Shidda (Relief After Hardship)",
  HammWaHuzn: 'Al-Hamm wa al-Huzn (Worry and Grief)',
  Hawatif: 'Kitab al-Hawatif (Voices from the Unseen)',
  Hilm: 'Kitab al-Hilm (Forbearance)',
  HilmMucawiya: "Hilm Mu'awiya (The Forbearance of Mu'awiya)",
  HusnZannBiLlah: 'Husn al-Zann bi-llah (Thinking Well of God)',
  IctibarWaAcqab: "Al-I'tibar wa A'qab al-Surur wa al-Ahzan (Taking Heed, and the Aftermath of Joys and Sorrows)",
  IkhlasWaNiyya: 'Al-Ikhlas wa al-Niyya (Sincerity and Intention)',
  Ikhwan: 'Kitab al-Ikhwan (Brethren)',
  IslahMal: 'Islah al-Mal (Setting Wealth Right)',
  IstinacMacruf: "Istina' al-Ma'ruf (Doing Good to Others)",
  Juc: "Kitab al-Ju' (Hunger)",
  KalamLayali: 'Kalam al-Layali wa al-Ayyam (What the Nights and Days Say)',
  MakaidShaytan: "Maka'id al-Shaytan (The Snares of Satan)",
  MakarimAkhlaq: 'Makarim al-Akhlaq (Noble Character)',
  ManCashaBacdaMawt: "Man 'Asha ba'd al-Mawt (Those Who Lived After Death)",
  Manamat: 'Kitab al-Manamat (Dreams)',
  MaqtalCali: "Maqtal 'Ali (The Killing of 'Ali)",
  MaradWaKaffarat: 'Al-Marad wa al-Kaffarat (Illness and Expiation)',
  MatarWaRacd: "Al-Matar wa al-Ra'd wa al-Barq (Rain, Thunder and Lightning)",
  MudaratNas: 'Mudarat al-Nas (Gentleness with People)',
  MuhasabatNafs: 'Muhasabat al-Nafs (Self-Accounting)',
  Muhtadarin: 'Kitab al-Muhtadarin (The Dying)',
  MujabuDacwa: "Mujabu al-Da'wa (Those Whose Prayers Were Answered)",
  Mutamannin: 'Kitab al-Mutamannin (Those Who Made Wishes)',
  QadaHawaij: "Qada' al-Hawa'ij (Meeting People's Needs)",
  Qanaca: "Kitab al-Qana'a (Contentment)",
  QasrAmal: 'Qasr al-Amal (Curbing Worldly Hopes)',
  QiraDayf: 'Qira al-Dayf (Hosting the Guest)',
  Qubur: 'Kitab al-Qubur (Graves)',
  RasailFiTawakkul: "Rasa'il fi al-Tawakkul (Epistles on Reliance on God)",
  Rida: "Kitab al-Rida (Acceptance of God's Decree)",
  RiqqaWaBuka: "Al-Riqqa wa al-Buka' (Tenderness of Heart and Weeping)",
  Sabr: 'Kitab al-Sabr (Patience)',
  Samt: 'Al-Samt wa Adab al-Lisan (Silence and the Etiquette of the Tongue)',
  Shukr: 'Kitab al-Shukr (Gratitude)',
  SifatJanna: 'Sifat al-Janna (Description of Paradise)',
  SifatNar: 'Sifat al-Nar (Description of Hellfire)',
  Tahajjud: 'Al-Tahajjud wa Qiyam al-Layl (Night Prayer and Vigil)',
  TawaducWaKhumul: "Al-Tawadu' wa al-Khumul (Humility and Obscurity)",
  Tawakkul: 'Kitab al-Tawakkul (Reliance on God)',
  Tawba: 'Kitab al-Tawba (Repentance)',
  Wajal: 'Kitab al-Wajal (Fearful Awe)',
  Warac: "Kitab al-Wara' (Scrupulous Piety)",
  Yaqin: 'Kitab al-Yaqin (Certainty)',
  Zuhd: 'Kitab al-Zuhd (Renunciation)',
};

/** Key-derived fallback (old behaviour), used only for keys without an entry above. */
function titleEnFromKey(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/C([A-Z])/g, "'$1");
}

export function titleEnFor(key: string): string {
  return DUNYA_TITLES_EN[key] ?? titleEnFromKey(key);
}
