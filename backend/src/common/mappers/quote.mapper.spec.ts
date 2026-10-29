import { describe, expect, it } from 'vitest';
import { mapQuoteToDto, type QuoteRowForDto } from './quote.mapper.js';

function row(overrides: Partial<Record<string, unknown>> = {}): QuoteRowForDto {
  return {
    id: 'q1',
    type: 'HADITH',
    origin: 'LOCAL',
    textAr: 'تبسّمك في وجه أخيك صدقة.',
    matnAr: null,
    isAthar: false,
    atharTextAr: null,
    atharSpeakerKey: null,
    atharSpeakerAr: null,
    atharAttributionKind: null,
    grade: 'SAHIH',
    gradeSource: 'MANUAL',
    gradeAuthority: 'الأستاذ أنس شيخ اكريم',
    gradeReference: 'وعزاه إلى البخاري',
    referenceNumber: null,
    referenceLabel: 'حلقة «بناء العادات»',
    narrator: null,
    narratorAr: null,
    apiProvider: 'lecture:anas-sheikh-akrim',
    externalId: '4EkrbmmIlno:tabassum',
    source: {
      id: 's1',
      name: 'Lectures of Anas Sheikh Akrim',
      nameAr: 'محاضرات الأستاذ أنس شيخ اكريم',
      type: 'SCHOLAR',
      author: 'Anas Sheikh Akrim',
      authorAr: 'أنس شيخ اكريم',
      isExternalApi: false,
      apiProvider: null,
    },
    translations: [],
    tags: [],
    matches: [],
    textSource: 'MANUAL',
    textVerifiedAt: null,
    volume: null,
    page: null,
    bookTitle: null,
    author: null,
    pageOrChapter: null,
    surahNumber: null,
    surahName: null,
    surahNameAr: null,
    ayahNumber: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  } as unknown as QuoteRowForDto;
}

describe('mapQuoteToDto: texts taken from a lecture', () => {
  it('shows no source, episode or grader for a `lecture:*` text', () => {
    const dto = mapQuoteToDto(row(), 'ar');
    expect(dto.source.name).toBe('');
    expect(dto.source.nameAr).toBeNull();
    expect(dto.source.authorAr).toBeNull();
    expect(dto.hadith?.reference).toBeNull();
    expect(dto.citation.gradeAuthority).toBeNull();
    expect(dto.citation.gradeReference).toBeNull();
    expect(JSON.stringify(dto)).not.toContain('أنس');
    expect(dto.hadith?.grade).toBe('SAHIH');
  });

  it('still says when a text was reported by its meaning, without who said so', () => {
    const maana = row({ gradeReference: 'رواه بمعناه، وعزاه إلى البخاري' });
    expect(mapQuoteToDto(maana, 'ar').citation.gradeReference).toBe('رُوي بالمعنى');
    expect(mapQuoteToDto(maana, 'en').citation.gradeReference).toBe('Reported by meaning');
    expect(mapQuoteToDto(row({ gradeReference: 'أورده بلفظه' }), 'ar').citation.gradeReference).toBeNull();
  });

  it('keeps the source of every other text', () => {
    const dto = mapQuoteToDto(row({ apiProvider: null, source: { ...row().source, nameAr: 'صحيح البخاري', name: 'Sahih al-Bukhari' } }), 'ar');
    expect(dto.source.nameAr).toBe('صحيح البخاري');
  });
});
