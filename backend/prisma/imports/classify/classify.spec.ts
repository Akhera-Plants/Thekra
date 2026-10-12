import { describe, expect, it } from 'vitest';
import { chapterTargets, classifyChapter, topicKey } from './classify.js';

describe('classifyChapter', () => {
  it('reads a prohibition as something to avoid', () => {
    expect(classifyChapter('باب تحريم الغيبة')).toMatchObject({ kind: 'AVOID', topic: 'غيبه', explicit: true });
    expect(classifyChapter('الترهيب من الكذب')).toMatchObject({ kind: 'AVOID', topic: 'كذب', explicit: true });
    expect(classifyChapter('باب النهي عن الغضب')).toMatchObject({ kind: 'AVOID', topic: 'غضب', explicit: true });
    expect(classifyChapter('باب ذم الحسد')).toMatchObject({ kind: 'AVOID', topic: 'حسد', explicit: true });
  });

  it('reads encouragement as something to do', () => {
    expect(classifyChapter('الترغيب في الصدق')).toMatchObject({ kind: 'DO', topic: 'صدق', explicit: true });
    expect(classifyChapter('باب فضل الصلاة')).toMatchObject({ kind: 'DO', topic: 'صلاه', explicit: true });
    expect(classifyChapter('باب استحباب الذكر')).toMatchObject({ kind: 'DO', topic: 'ذكر', explicit: true });
    expect(classifyChapter('باب الحث على الصدقة')).toMatchObject({ kind: 'DO', topic: 'صدقه', explicit: true });
  });

  it('leaves a title with no class word unlinked', () => {
    expect(classifyChapter('باب ما جاء في الوضوء').kind).toBe('NEUTRAL');
    expect(classifyChapter('كتاب بدء الوحي').kind).toBe('NEUTRAL');
    expect(classifyChapter('').kind).toBe('NEUTRAL');
  });

  it('does not pick a class when the title warns and encourages', () => {
    expect(classifyChapter('الترغيب في الصدق والترهيب من الكذب')).toMatchObject({
      kind: 'AMBIGUOUS',
      explicit: false,
    });
    expect(chapterTargets('الترغيب في الصدق والترهيب من الكذب')).toEqual([
      { kind: 'AVOID', topic: 'كذب', explicit: false },
      { kind: 'DO', topic: 'صدق', explicit: false },
    ]);
  });

  it('treats a kabira heading as avoid, without the ordinal', () => {
    expect(classifyChapter('الكبيرة الأولى الشرك بالله')).toMatchObject({
      kind: 'AVOID',
      topic: 'شرك بالله',
      explicit: true,
    });
  });
});

describe('topicKey', () => {
  it('folds the article so the same topic meets across books', () => {
    expect(topicKey('الغيبة')).toBe(topicKey('غيبه'));
  });
});
