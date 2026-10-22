import { describe, expect, it } from 'vitest';
import { ayahTopicVerse, parseAyahDecisions, reviewAyahLinks } from './ayah-decisions.js';
import type { DesiredLink } from './links.js';

function link(partial: Pick<DesiredLink, 'slug' | 'quoteId' | 'basis' | 'classifiedBy'>): DesiredLink {
  return {
    side: 'DO',
    slug: partial.slug,
    quoteId: partial.quoteId,
    basis: partial.basis,
    classifiedBy: partial.classifiedBy,
    reviewStatus: 'ACCEPTED',
    note: 'note',
    relevanceScore: 90,
    sectionId: 'section',
    sectionOrder: 1,
    itemOrder: 1,
    priority: 50,
  };
}

describe('ayah review decisions', () => {
  it('parses keep and drop', () => {
    const rows = parseAyahDecisions('linkId\ttopicSlug\tverseKey\tdecision\treason\nq1\tsabr\t71:5\tdrop\tاستطراد\nq2\ttawakkul\t58:10\tkeep\tمباشر\n');
    expect(rows.map((row) => row.decision)).toEqual(['drop', 'keep']);
  });

  it('drops a verse and marks a keep as reviewer without changing basis', () => {
    const dropped = new Set([ayahTopicVerse('sabr', '71:5')]);
    const kept = new Set([ayahTopicVerse('tawakkul', '58:10')]);
    const verses = new Map([
      ['q-drop', '71:5'],
      ['q-keep', '58:10'],
      ['q-hadith', null],
    ]);
    const result = reviewAyahLinks(
      [
        link({ slug: 'sabr', quoteId: 'q-drop', basis: 'AUTHOR_CITATION', classifiedBy: 'BOOK' }),
        link({ slug: 'tawakkul', quoteId: 'q-keep', basis: 'AUTHOR_CITATION', classifiedBy: 'BOOK' }),
        link({ slug: 'sabr', quoteId: 'q-hadith', basis: 'CHAPTER', classifiedBy: 'BOOK' }),
      ],
      dropped,
      kept,
      (quoteId) => verses.get(quoteId) ?? null,
    );
    expect(result.map((row) => row.quoteId)).toEqual(['q-keep', 'q-hadith']);
    expect(result[0]).toMatchObject({ classifiedBy: 'REVIEWER', basis: 'AUTHOR_CITATION' });
    expect(result[1]?.classifiedBy).toBe('BOOK');
  });
});
