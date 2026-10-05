'use client';

import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useHadithCollections } from '@/features/quran-hadith-browser/hooks/useHadithCollections';
import { useSurahs } from '@/features/quran-hadith-browser/hooks/useSurahs';
import type { HadithGrade } from '@/lib/types/enums';

interface QuoteFiltersProps {
  tab: string;
  grade?: string;
  surah?: string;
  sourceId?: string;
  onGradeChange: (grade: string) => void;
  onSurahChange: (surah: string) => void;
  onSourceChange: (source: string) => void;
}

const HADITH_GRADES: Array<{ value: HadithGrade; labelKey: string }> = [
  { value: 'SAHIH', labelKey: 'quote.grade.sahih' },
  { value: 'HASAN', labelKey: 'quote.grade.hasan' },
  { value: 'DAIF', labelKey: 'quote.grade.daif' },
];

export function QuoteFilters({
  tab,
  grade,
  surah,
  sourceId,
  onGradeChange,
  onSurahChange,
  onSourceChange,
}: QuoteFiltersProps) {
  const tBrowse = useTranslations('browse');
  const tQuote = useTranslations('quote');
  const { data: surahsData } = useSurahs();
  const { data: collectionsData } = useHadithCollections();
  const surahs = surahsData?.data ?? [];
  const collections = collectionsData?.data ?? [];

  return (
    <div className="flex flex-wrap gap-2">
      {/* Grade filter — shown for all/hadith tabs */}
      {tab !== 'quran' && (
        <Select value={grade ?? ''} onValueChange={onGradeChange}>
          <SelectTrigger
            className="w-40"
            aria-label={tBrowse('filterGrade')}
          >
            <SelectValue placeholder={tBrowse('allGrades')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{tBrowse('allGrades')}</SelectItem>
            {HADITH_GRADES.map((g) => (
              <SelectItem key={g.value} value={g.value}>
                {tQuote(g.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Surah filter — shown for quran/all tabs */}
      {tab !== 'hadith' && surahs.length > 0 && (
        <Select value={surah ?? ''} onValueChange={onSurahChange}>
          <SelectTrigger
            className="w-48"
            aria-label={tBrowse('filterSurah')}
          >
            <SelectValue placeholder={tBrowse('allSurahs')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{tBrowse('allSurahs')}</SelectItem>
            {surahs.map((s) => (
              <SelectItem key={s.number} value={String(s.number)}>
                <span dir="rtl" lang="ar" className="font-arabic me-2">
                  {s.nameAr}
                </span>
                <bdi className="text-xs text-muted-foreground">{s.number}</bdi>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Collection filter — shown for hadith/all tabs */}
      {tab !== 'quran' && collections.length > 0 && (
        <Select value={sourceId ?? ''} onValueChange={onSourceChange}>
          <SelectTrigger
            className="w-48"
            aria-label={tBrowse('filterCollection')}
          >
            <SelectValue placeholder={tBrowse('allCollections')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{tBrowse('allCollections')}</SelectItem>
            {collections.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nameAr ? (
                  <span dir="rtl" lang="ar" className="font-arabic">
                    {c.nameAr}
                  </span>
                ) : (
                  c.name
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
