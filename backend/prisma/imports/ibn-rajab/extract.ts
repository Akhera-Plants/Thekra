export interface RajabTopic {
  slug: string;
  side: 'sin' | 'deed';
}

export interface RajabPassage {
  text: string;
  page: number;
  topics: RajabTopic[];
}

const JUNK = /طبقات الحفاظ|شذرات الذهب|حقوق الطبع|بروتوكول|ترجمة رقم|البدر الطالع|المنهج الأحمد|الجوهر المنضد|الإمام العالم الصالح|انظر بسط|زوائد الهيثمي|في المصنف/;
const WEAK_MARK = /إسناد[هه]?\s*ضعيف|اسناد ضعيف|لا يصح|لم يصح|لا يثبت|لم يثبت|ضعيف|نكار|وجوه ضعيفة|الصحيح وقفه|روي موقوفا|موقوف|مرسل|منقطع/;
/** Author critique / commentary — never treat as a prophetic report. */
const CRITIQUE_MARK =
  /باطلة|منكرة|وهذا يدل|وقد أشكل|إخواني|وفي حديثه زيادة|\([هـه٠-٩0-9]{1,3}\)|（[هـه٠-٩0-9]{1,3}）/;
const COMMENTARY_CUT = /(?:وقد|وهذا|قال ابن)/;
const PRIOR_CUE = /قال\s+رسول|قال\s+النبي|عن\s+النبي|مرفوع|صلى\s+الله\s+عليه|خرجه|خرج\s/;

function leadPattern(): RegExp {
  return /(?:قال\s+رسول\s+الله|قال\s+النبي|عن\s+النبي|مرفوعاً|مرفوعًا|قوله\s+صلى\s+الله\s+عليه|خرج\s+(?:البخاري|مسلم|الترمذي|أبو داود|ابو داود|النسائي|ابن ماجه|أحمد|احمد|ابن حبان|الحاكم)[^.]{0,80}?قال)\s*(?:صلى\s+الله\s+عليه\s*(?:وسلم|وآله)\s*)?(?:قال\s*)?[:：]?\s*/g;
}

const LATAIF_RULES: ReadonlyArray<{ test: RegExp; topics: readonly RajabTopic[] }> = [
  { test: /عاشوراء/, topics: [{ slug: 'siyam', side: 'deed' }] },
  { test: /قدوم الحاج|يوم عرفة|ذي الحجة|ذِي الحجة|التشريق/, topics: [{ slug: 'hajj', side: 'deed' }] },
  { test: /ليلة القدر|قيام الليل|السبع الأواخر|العشر الأواخر|العشر الأوسط/, topics: [{ slug: 'nawafil', side: 'deed' }] },
  { test: /الجود|الصدقة/, topics: [{ slug: 'sadaqah', side: 'deed' }] },
  { test: /التوبة|الاستغفار/, topics: [{ slug: 'tawba', side: 'deed' }] },
  { test: /التذكير بالله|مجالس الوعظ|ذكر الله/, topics: [{ slug: 'dhikr', side: 'deed' }] },
  { test: /وفاة النبي|ذكر الموت/, topics: [{ slug: 'zuhd', side: 'deed' }] },
  { test: /مولد رسول|مولده عليه/, topics: [{ slug: 'mahabbat-allah', side: 'deed' }] },
  { test: /صيام|الصوم|رمضان|شعبان|المحرم/, topics: [{ slug: 'siyam', side: 'deed' }] },
];

/** The first heading on the page chooses the topic. A page without one keeps the previous council. */
export function lataifTopics(page: string, previous: readonly RajabTopic[]): RajabTopic[] {
  const head = page.replace(/\s+/g, ' ').slice(0, 220);
  for (const rule of LATAIF_RULES) {
    if (rule.test.test(head)) return [...rule.topics];
  }
  return [...previous];
}

function clean(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[([（][0-9٠-٩۰-۹]+[)）\]]/g, '')
    .replace(/\[[^\]]{0,24}\]/g, '')
    .replace(/^(?:وسلم|صلى الله عليه(?: وسلم)?)\s*[:،,]?\s*/, '')
    .trim();
}

/** Cut the matn at the closing quote, or at author commentary that follows it. */
export function stopMatn(raw: string): string {
  const closed = raw.match(/^([^»]{12,420})»/);
  if (closed?.[1]) return clean(closed[1]);
  const cut = COMMENTARY_CUT.exec(raw);
  if (cut?.index != null && cut.index >= 18) return clean(raw.slice(0, cut.index));
  const sentence = raw.match(/^([^.]{18,340})/);
  return sentence?.[1] ? clean(sentence[1]) : clean(raw.slice(0, 340));
}

function keepMatn(text: string, around: string): boolean {
  if (text.length < 24 || text.length > 420) return false;
  if (/^(?:وسلم|صلى الله عليه)/.test(text)) return false;
  if ((text.match(/[\u0621-\u064A]/g) ?? []).length < 20) return false;
  if (JUNK.test(text) || WEAK_MARK.test(text) || WEAK_MARK.test(around)) return false;
  if (CRITIQUE_MARK.test(text) || CRITIQUE_MARK.test(around)) return false;
  if ((text.match(/[0-9]/g) ?? []).length > 6) return false;
  return true;
}

function matnAfter(compact: string, at: number): string | null {
  const rest = compact.slice(at);
  const quoted = rest.match(/^\s*«([^»]{12,420})»/);
  if (quoted?.[1]) return clean(quoted[1]);
  const paren = rest.match(/^\s*\(([^)]{12,280})\)/);
  if (paren?.[1]) return clean(paren[1]);
  return stopMatn(rest.replace(/^\s+/, ''));
}

function priorClause(compact: string, index: number): string {
  const slice = compact.slice(Math.max(0, index - 120), index);
  const cut = Math.max(slice.lastIndexOf('.'), slice.lastIndexOf('۔'), slice.lastIndexOf('。'));
  return cut >= 0 ? slice.slice(cut + 1) : slice;
}

function passagesOnPage(compact: string): string[] {
  const found: string[] = [];
  for (const match of compact.matchAll(leadPattern())) {
    const at = (match.index ?? 0) + match[0].length;
    const text = matnAfter(compact, at);
    if (!text) continue;
    const around = compact.slice(Math.max(0, match.index ?? 0), Math.min(compact.length, at + text.length + 180));
    if (!keepMatn(text, around)) continue;
    found.push(text);
  }
  for (const match of compact.matchAll(/«([^»]{18,420})»/g)) {
    const text = clean(match[1] ?? '');
    const prior = priorClause(compact, match.index ?? 0);
    if (!PRIOR_CUE.test(prior)) continue;
    const end = (match.index ?? 0) + match[0].length;
    const around = compact.slice(Math.max(0, (match.index ?? 0) - 80), Math.min(compact.length, end + 180));
    if (!keepMatn(text, around)) continue;
    found.push(text);
  }
  return found;
}

const BODY_START: Record<string, RegExp> = {
  khamr: /الخمر/,
  yatba: /يتبع الميت/,
  istinshaq: /الحمد لله الذي فتح|أصول\s*:\s*الخوف/,
  mahajja: /لن يُنَجِّي|لن ينجي/,
  ikhtiyar: /الملأ الأعلى|اختصام/,
  takhweef: /أنذرتكم النار|التخويف من النار/,
  qubur: /عذاب القبر|الباب الأول/,
  lataif: /المجلس الأول/,
};

/**
 * Prophetic reports from the author's text for topic selection.
 * Ibn Rajab does not grade; weak marks and critique are left out.
 */
export function extractRajabPassages(
  bookKey: string,
  text: string,
  topics: readonly RajabTopic[],
): RajabPassage[] {
  const pages = text.split('PAGE_SEPARATOR');
  const start = BODY_START[bookKey];
  let begun = false;
  let carry: RajabTopic[] = [...topics];
  const seen = new Set<string>();
  const passages: RajabPassage[] = [];
  pages.forEach((page, index) => {
    const compact = page.replace(/\s+/g, ' ').trim();
    if (!begun) {
      if (!start?.test(compact)) return;
      begun = true;
    }
    const pageTopics = bookKey === 'lataif' ? lataifTopics(compact, carry) : carry;
    if (bookKey === 'lataif') carry = pageTopics;
    if (pageTopics.length === 0) return;
    for (const report of passagesOnPage(compact)) {
      if (seen.has(report)) continue;
      seen.add(report);
      passages.push({ text: report, page: index + 1, topics: pageTopics });
    }
  });
  return passages;
}
