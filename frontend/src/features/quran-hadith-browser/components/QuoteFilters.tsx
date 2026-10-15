'use client';

import { useLocale, useTranslations } from 'next-intl';
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

const ALL = '__all__';

const HADITH_GRADES = [
  { value: 'SAHIH' as const, labelKey: 'grade.sahih' as const },
  { value: 'HASAN' as const, labelKey: 'grade.hasan' as const },
  { value: 'DAIF' as const, labelKey: 'grade.daif' as const },
] satisfies Array<{
  value: HadithGrade;
  labelKey: 'grade.sahih' | 'grade.hasan' | 'grade.daif';
}>;

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
  const locale = useLocale();
  const arabic = locale === 'ar';
  const { data: surahsData } = useSurahs();
  const { data: collectionsData } = useHadithCollections();
  const surahs = surahsData?.data ?? [];
  const collections = collectionsData?.data ?? [];

  return (
    <div className="flex flex-wrap gap-2">
      {tab !== 'quran' ? (
        <Select
          key="grade"
          value={grade && grade.length > 0 ? grade : ALL}
          onValueChange={(v) => onGradeChange(v === ALL ? '' : v)}
        >
          <SelectTrigger
            className="w-40"
            aria-label={tBrowse('filterGrade')}
          >
            <SelectValue placeholder={tBrowse('allGrades')} />
          </SelectTrigger>
          <SelectContent>
            {[
              <SelectItem key="all-grades" value={ALL}>
                {tBrowse('allGrades')}
              </SelectItem>,
              ...HADITH_GRADES.map((g) => (
                <SelectItem key={g.value} value={g.value}>
                  {tQuote(g.labelKey)}
                </SelectItem>
              )),
            ]}
          </SelectContent>
        </Select>
      ) : null}

      {tab !== 'hadith' && surahs.length > 0 ? (
        <Select
          key="surah"
          value={surah && surah.length > 0 ? surah : ALL}
          onValueChange={(v) => onSurahChange(v === ALL ? '' : v)}
        >
          <SelectTrigger
            className="w-48"
            aria-label={tBrowse('filterSurah')}
          >
            <SelectValue placeholder={tBrowse('allSurahs')} />
          </SelectTrigger>
          <SelectContent>
            {[
              <SelectItem key="all-surahs" value={ALL}>
                {tBrowse('allSurahs')}
              </SelectItem>,
              ...surahs.map((s) => (
                <SelectItem
                  key={`surah-${s.surahNumber}`}
                  value={String(s.surahNumber)}
                >
                  {`${arabic ? (s.surahNameAr ?? s.surahName) : (s.surahName ?? s.surahNameAr) ?? s.surahNumber} (${s.surahNumber})`}
                </SelectItem>
              )),
            ]}
          </SelectContent>
        </Select>
      ) : null}

      {tab !== 'quran' && collections.length > 0 ? (
        <Select
          key="collection"
          value={sourceId && sourceId.length > 0 ? sourceId : ALL}
          onValueChange={(v) => onSourceChange(v === ALL ? '' : v)}
        >
          <SelectTrigger
            className="w-48"
            aria-label={tBrowse('filterCollection')}
          >
            <SelectValue placeholder={tBrowse('allCollections')} />
          </SelectTrigger>
          <SelectContent>
            {[
              <SelectItem key="all-collections" value={ALL}>
                {tBrowse('allCollections')}
              </SelectItem>,
              ...collections.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {arabic || !c.name ? (
                    c.nameAr ? <span dir="rtl" lang="ar" className="font-arabic-ui">{c.nameAr}</span> : c.name
                  ) : (
                    c.name
                  )}
                </SelectItem>
              )),
            ]}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
}
