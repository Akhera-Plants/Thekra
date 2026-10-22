import { extractRajabPassages, stopMatn } from './extract.js';
import { RAJAB_BOOKS } from './books.js';

describe('RAJAB_BOOKS', () => {
  it('carries no whole-book topics (links come only from taxonomy chapters)', () => {
    for (const book of RAJAB_BOOKS) {
      expect(book).not.toHaveProperty('topics');
    }
  });
});

describe('stopMatn', () => {
  it('cuts at author commentary after the report', () => {
    expect(stopMatn('ما اعلموا أنكم لن تروا ربكم حتى تموتوا وهذا يدل بمفهومه على الرؤية')).toBe(
      'ما اعلموا أنكم لن تروا ربكم حتى تموتوا',
    );
  });
});

describe('extractRajabPassages', () => {
  it('keeps a prophetic report and creates 0 topic links on the passage', () => {
    const text = [
      'غلاف',
      'PAGE_SEPARATOR',
      'خرج الدارقطني بإسناد ضعيف (الخمر أم الفواحش وأكبر الكبائر). قال رسول الله صلى الله عليه وسلم : «من شرب الخمر لم تقبل له صلاة أربعين يوماً».',
    ].join('');
    const passages = extractRajabPassages('khamr', text);
    expect(passages.map((row) => row.text)).toEqual([
      'من شرب الخمر لم تقبل له صلاة أربعين يوماً',
    ]);
    expect(passages[0]).not.toHaveProperty('topics');
  });

  it('an Ibn Rajab extract never attaches topics (import must create 0 topic links)', () => {
    const body =
      'PAGE_SEPARATOR التخويف من النار قال رسول الله صلى الله عليه وسلم : «اللهم بارك لنا في رجب وشعبان وبلغنا رمضان».';
    const passages = extractRajabPassages('takhweef', body);
    expect(passages.length).toBe(1);
    expect(passages.every((row) => !('topics' in row))).toBe(true);
  });

  it('ignores a biography that merely names the Prophet', () => {
    const text = 'PAGE_SEPARATOR لطائف المعارف المجلس الأول «طبقات الحفاظ ترجمة رقم ٥٧ والمنهج الأحمد»';
    expect(extractRajabPassages('lataif', text).map((row) => row.text)).toEqual([]);
  });

  it('rejects the audit examples that mix author critique into the matn', () => {
    const body = [
      'PAGE_SEPARATOR التخويف من النار',
      'قال رسول الله صلى الله عليه وسلم : «وأحاديث يعلى بن الأشدق باطلة منكرة».',
      'قال رسول الله صلى الله عليه وسلم : «خير منازل المسلمين يومئذ (ه). إخواني! من كان من هذه الأمة».',
      'قال رسول الله صلى الله عليه وسلم : «اتقوا النار ولو بشق تمرة» وقد أشكل على بعض الناس الجمع بين هذا الحديث والآخر.',
      'قال رسول الله صلى الله عليه وسلم : ما اعلموا أنكم لن تروا ربكم حتى تموتوا وهذا يدل بمفهومه على الرؤية.',
    ].join(' ');
    const passages = extractRajabPassages('takhweef', body);
    expect(passages.map((row) => row.text)).toEqual([]);
  });

  it('still extracts a bare dua that has no nearby critique (grade is never written)', () => {
    const body =
      'PAGE_SEPARATOR التخويف من النار قال رسول الله صلى الله عليه وسلم : «اللهم بارك لنا في رجب وشعبان وبلغنا رمضان».';
    const passages = extractRajabPassages('takhweef', body);
    expect(passages.map((row) => row.text)).toEqual([
      'اللهم بارك لنا في رجب وشعبان وبلغنا رمضان',
    ]);
  });
});
