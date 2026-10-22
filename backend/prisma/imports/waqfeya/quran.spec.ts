import { describe, expect, it } from 'vitest';
import { applyVerseReplacements, boundSpan, keysCovering, wordSpans } from './quran.js';

describe('applyVerseReplacements', () => {
  it('replaces the detector word span with Uthmani and keeps the page marker', () => {
    const text = 'قال تعالى واصبر وما صبرك الا بالله [[1:4]] ثم قال الحمد لله رب العالمين';
    const words = wordSpans(text).map((span) => text.slice(span.start, span.end));
    expect(words[2]).toBe('واصبر');
    const { text: replaced, hits } = applyVerseReplacements(
      text,
      [
        { startWord: 2, endWord: 7, surah: 16, ayahStart: 127, ayahEnd: 127 },
        { startWord: 9, endWord: 12, surah: 1, ayahStart: 2, ayahEnd: 2 },
      ],
      (surah, ayah) => `UTHMANI ${surah}:${ayah}`,
    );
    expect(replaced).toContain('UTHMANI 16:127');
    expect(replaced).toContain('UTHMANI 1:2');
    expect(replaced).toContain('[[1:4]]');
    expect(replaced).not.toContain('واصبر');
    expect(replaced).not.toContain('الحمد');
    expect(hits.flatMap((hit) => hit.keys)).toEqual(['16:127', '1:2']);
    const narrationStart = replaced.indexOf('UTHMANI 16:127');
    expect(keysCovering(hits, narrationStart, narrationStart + 5)).toEqual(['16:127']);
  });

  it('clamps a distant ayah merge to the first verse and drops a span that would erase the page', () => {
    expect(boundSpan({ startWord: 10, endWord: 90000, surah: 10, ayahStart: 62, ayahEnd: 64 }, 18)).toEqual({
      startWord: 10,
      endWord: 28,
      surah: 10,
      ayahStart: 62,
      ayahEnd: 62,
    });
    expect(boundSpan({ startWord: 10, endWord: 90000, surah: 2, ayahStart: 255, ayahEnd: 255 })).toBeNull();
  });
});
