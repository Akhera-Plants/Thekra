import { describe, expect, it } from 'vitest';
import { stripPageMarkers } from './strip-page-markers.js';

// ── Positive cases: markers that MUST be removed ─────────────────────────────

describe('stripPageMarkers — page markers are removed', () => {
  it('removes [ص: N] with space after colon (Ibn Abi al-Dunya example)', () => {
    expect(stripPageMarkers('فقلت [ص: 266] : من هؤلاء يا جبريل')).toBe(
      'فقلت : من هؤلاء يا جبريل',
    );
  });

  it('removes [ص:N] without space after colon', () => {
    expect(stripPageMarkers('نص [ص:12] هنا')).toBe('نص هنا');
  });

  it('removes [ص N] with space instead of colon', () => {
    expect(stripPageMarkers('نص [ص 34] هنا')).toBe('نص هنا');
  });

  it('removes (ص N) parenthesis variant', () => {
    expect(stripPageMarkers('نص (ص 99) هنا')).toBe('نص هنا');
  });

  it('removes volume+page form [ج2 ص: 15]', () => {
    expect(stripPageMarkers('بداية [ج2 ص: 15] نهاية')).toBe('بداية نهاية');
  });

  it('removes volume+page form [ج2 ص 15] without colon', () => {
    expect(stripPageMarkers('بداية [ج2 ص 15] نهاية')).toBe('بداية نهاية');
  });

  it('removes volume+page form (ج3 ص 400)', () => {
    expect(stripPageMarkers('نص (ج3 ص 400) نص')).toBe('نص نص');
  });

  it('removes [ج2 ص:15] without space between colon and digits', () => {
    expect(stripPageMarkers('نص [ج2 ص:15] آخر')).toBe('نص آخر');
  });

  it('removes multiple page markers in one string', () => {
    expect(
      stripPageMarkers('أول [ص: 1] وسط [ج1 ص: 2] آخر'),
    ).toBe('أول وسط آخر');
  });

  it('removes a marker at the start of a string', () => {
    expect(stripPageMarkers('[ص: 5] نص')).toBe('نص');
  });

  it('removes a marker at the end of a string', () => {
    expect(stripPageMarkers('نص [ص: 5]')).toBe('نص');
  });

  it('collapses double spaces left by the removal', () => {
    expect(stripPageMarkers('كلمة  [ص: 10]  كلمة')).toBe('كلمة كلمة');
  });

  it('removes a standalone page marker on its own line (Ibn Abi al-Dunya pattern)', () => {
    // newline-wrapped page break mid-sentence — not preceded by }
    expect(
      stripPageMarkers('قال له: كيف تجدك؟ \n[ص: 238]\n فسجد أربعين ليلة'),
    ).toBe('قال له: كيف تجدك؟ \n \n فسجد أربعين ليلة');
  });

  it('strips only the standalone page break, not the adjacent verse citations', () => {
    // Real Ibn Abi al-Dunya pattern: } [ص: 22] and } [ص: 24] are verse refs
    // (kept); \n[ص: 238]\n is a page break (stripped).
    const input =
      '{لا تخف خصمان} [ص: 22] إلى قوله: {وخر راكعا وأناب} [ص: 24]\n[ص: 238]\nفسجد أربعين ليلة';
    const expected =
      '{لا تخف خصمان} [ص: 22] إلى قوله: {وخر راكعا وأناب} [ص: 24]\n \nفسجد أربعين ليلة';
    expect(stripPageMarkers(input)).toBe(expected);
  });
});

// ── Idempotency ───────────────────────────────────────────────────────────────

describe('stripPageMarkers — idempotency', () => {
  it('second call on already-clean text produces the same result', () => {
    const clean = stripPageMarkers('فقلت [ص: 266] : من هؤلاء يا جبريل');
    expect(stripPageMarkers(clean)).toBe(clean);
  });

  it('second call on text with kept verse citations produces the same result', () => {
    const text = 'فقال: {هب لي ملكا لا ينبغي لأحد من بعدي} [ص: 35] فرده الله';
    expect(stripPageMarkers(text)).toBe(text);
  });
});

// ── Negative cases: patterns that MUST NOT be changed ────────────────────────

describe('stripPageMarkers — verse citations after } are preserved', () => {
  it('keeps [ص: N] immediately after } — real Riyad example: [ص: 86]', () => {
    // وعن مسروق … {قل ما أسألكم عليه من أجر وما أنا من المتكلفين}. [ص: 86]. رواه البخاري.
    const text =
      'وعن مسروق، قال: {قل ما أسألكم عليه من أجر وما أنا من المتكلفين}. [ص: 86]. رواه البخاري.';
    expect(stripPageMarkers(text)).toBe(text);
  });

  it('keeps [ص: 35] immediately after } — real Sahihayn example', () => {
    // فذكرت قول سليمان: رب {هب لي ملكا لا ينبغي لأحد من بعدي} [ص: 35] فرده الله خاسيا
    const text =
      'فذكرت قول سليمان: رب {هب لي ملكا لا ينبغي لأحد من بعدي} [ص: 35] فرده الله خاسيا';
    expect(stripPageMarkers(text)).toBe(text);
  });

  it('keeps [ص: 20] immediately after } — real Sahihayn/book-structure example', () => {
    // إلى قوله: {وفصل الخطاب} [ص: 20]، قال مجاهد
    const text = 'إلى قوله: {وفصل الخطاب} [ص: 20]، قال مجاهد';
    expect(stripPageMarkers(text)).toBe(text);
  });

  it('keeps [ص: N] after }. (period between close-brace and marker)', () => {
    const text = '{وما أنا من المتكلفين}. [ص: 86].';
    expect(stripPageMarkers(text)).toBe(text);
  });

  it('keeps [ص: N] after } with multiple spaces (spaces are normalised)', () => {
    // The marker is preserved; the multi-space run is collapsed to one space
    // by the global space normaliser that runs after all substitutions.
    expect(stripPageMarkers('{آية}   [ص: 7]')).toBe('{آية} [ص: 7]');
  });

  it('keeps [ص: N] after ﴾ (closing Quran ornamental bracket U+FD3E)', () => {
    // ﴾ is U+FD3E; ﴿ is U+FD3F
    const text = '﴿ إِنَّا فَتَحْنَا لَكَ فَتْحًا مُّبِينًا ﴾ [ص: 1]';
    expect(stripPageMarkers(text)).toBe(text);
  });

  it('keeps multiple sequential } [ص: N] patterns', () => {
    const text = '{لا تخف} [ص: 22] إلى قوله: {وخر راكعا وأناب} [ص: 24]';
    expect(stripPageMarkers(text)).toBe(text);
  });
});

describe('stripPageMarkers — other non-markers are preserved', () => {
  it('preserves Quran ornamental brackets ﴿ ﴾', () => {
    const text = '﴿ إِنَّا أَعْطَيْنَاكَ الْكَوْثَرَ ﴾';
    expect(stripPageMarkers(text)).toBe(text);
  });

  it('preserves curly-brace spans { … } (Quran text)', () => {
    const text = 'قال تعالى {بسم الله الرحمن الرحيم} في كتابه';
    expect(stripPageMarkers(text)).toBe(text);
  });

  it('preserves plain square brackets containing a word', () => {
    const text = 'قال [علي] رضي الله عنه';
    expect(stripPageMarkers(text)).toBe(text);
  });

  it('preserves [الصفحة] — bracket starting with ص as part of a word', () => {
    const text = 'انظر [الصفحة] الأولى';
    expect(stripPageMarkers(text)).toBe(text);
  });

  it('preserves empty string', () => {
    expect(stripPageMarkers('')).toBe('');
  });

  it('preserves text with no markers at all', () => {
    const text = 'هذا نص عربي عادي بدون علامات';
    expect(stripPageMarkers(text)).toBe(text);
  });

  it('preserves [ص] without a page number', () => {
    const text = 'كما في [ص] الكتاب';
    expect(stripPageMarkers(text)).toBe(text);
  });

  it('preserves Quran surah-name citations like [البقرة: 147]', () => {
    const text = 'قرأ: {الحق من ربك فلا تكونن من الممترين} [البقرة: 147]';
    expect(stripPageMarkers(text)).toBe(text);
  });
});
