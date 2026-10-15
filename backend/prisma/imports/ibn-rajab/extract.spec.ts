import { extractRajabPassages, lataifTopics } from './extract.js';

describe('lataifTopics', () => {
  it('sends Ashura to fasting and keeps that council on the next page', () => {
    const ashura = lataifTopics('المجلس الثاني في يوم عاشوراء وصومه', []);
    expect(ashura).toEqual([{ slug: 'siyam', side: 'deed' }]);
    expect(lataifTopics('وذكر فيه فضل صومه على التطوع', ashura)).toEqual(ashura);
  });

  it('sends the last ten nights to night prayer', () => {
    expect(lataifTopics('المجلس الخامس في ذكر السبع الأواخر من رمضان', [])).toEqual([
      { slug: 'nawafil', side: 'deed' },
    ]);
  });
});

describe('extractRajabPassages', () => {
  it('keeps a prophetic report and drops one Ibn Rajab marks weak beside it', () => {
    const text = [
      'غلاف',
      'PAGE_SEPARATOR',
      'خرج الدارقطني بإسناد ضعيف (الخمر أم الفواحش وأكبر الكبائر). قال رسول الله صلى الله عليه وسلم : «من شرب الخمر لم تقبل له صلاة أربعين يوماً».',
    ].join('');
    const passages = extractRajabPassages('khamr', text, [{ slug: 'khamr', side: 'sin' }]);
    expect(passages.map((row) => row.text)).toEqual([
      'من شرب الخمر لم تقبل له صلاة أربعين يوماً',
    ]);
    expect(passages[0]?.topics).toEqual([{ slug: 'khamr', side: 'sin' }]);
  });

  it('ignores a biography that merely names the Prophet', () => {
    const text = 'PAGE_SEPARATOR لطائف المعارف المجلس الأول «طبقات الحفاظ ترجمة رقم ٥٧ والمنهج الأحمد»';
    expect(extractRajabPassages('lataif', text, []).map((row) => row.text)).toEqual([]);
  });
});
