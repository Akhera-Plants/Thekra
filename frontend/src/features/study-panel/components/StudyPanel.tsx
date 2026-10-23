'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Share2,
  X,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { BrandLoader } from '@/components/shared/feedback/BrandLoader';
import { QueryErrorState } from '@/components/shared/feedback/QueryErrorState';
import { Button } from '@/components/shared/kit/button';
import { SegmentTabs } from '@/components/shared/kit/segment-tabs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { QuoteDto } from '@/lib/types/api';
import { QuoteType } from '@/lib/types/enums';
import { useExplanations } from '../hooks/useExplanations';
import {
  hadithTabsForLocale,
  pickTabRows,
  verseTabsForLocale,
  type StudyTabId,
} from '../lib/tabs';
import { StudyReading } from './StudyReading';

function useIsMobile(breakpoint = 768) {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [breakpoint]);
  return mobile;
}

export interface StudyPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: QuoteDto | null;
  listIds?: string[];
  onNavigate?: (quoteId: string) => void;
}

export function StudyPanel({
  open,
  onOpenChange,
  quote,
  listIds = [],
  onNavigate,
}: StudyPanelProps) {
  const t = useTranslations('studyPanel');
  const locale = useLocale();
  const router = useRouter();
  const mobile = useIsMobile();
  const isVerse = quote?.type === QuoteType.QURAN_VERSE;
  const isHadith = quote?.type === QuoteType.HADITH;

  const candidateTabs = useMemo(
    () => (isVerse ? verseTabsForLocale(locale) : isHadith ? hadithTabsForLocale(locale) : []),
    [isVerse, isHadith, locale],
  );

  const { data: rows = [], isLoading, isError, error, refetch } = useExplanations(quote?.id ?? null, open);

  const availableTabs = useMemo(
    () => candidateTabs.filter((tab) => pickTabRows(rows, tab, locale).length > 0),
    [candidateTabs, rows, locale],
  );

  const [tab, setTab] = useState<StudyTabId | null>(null);
  const activeTab: StudyTabId | null =
    tab && availableTabs.includes(tab) ? tab : (availableTabs[0] ?? null);

  const activeRows = useMemo(
    () => (activeTab ? pickTabRows(rows, activeTab, locale) : []),
    [rows, activeTab, locale],
  );

  const index = quote && listIds.length > 0 ? listIds.indexOf(quote.id) : -1;
  const prevId = index > 0 ? listIds[index - 1] : null;
  const nextId = index >= 0 && index < listIds.length - 1 ? listIds[index + 1] : null;

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onOpenChange(false);
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const rtl = locale === 'ar';
        const goPrev =
          (event.key === 'ArrowLeft' && !rtl) || (event.key === 'ArrowRight' && rtl);
        const target = goPrev ? prevId : nextId;
        if (target && onNavigate) {
          event.preventDefault();
          onNavigate(target);
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, locale, prevId, nextId, onNavigate, onOpenChange]);

  const side = mobile ? 'bottom' : locale === 'ar' ? 'left' : 'right';
  const title = isVerse ? t('titleTafsir') : t('titleSharh');

  const tabItems = availableTabs.map((value) => ({
    value,
    label: t(`tabs.${value}`),
  }));

  function expandFull() {
    if (!quote) return;
    const tabQuery = activeTab ? `?tab=${activeTab}` : '';
    if (isVerse && quote.quran?.surahNumber && quote.quran?.ayahNumber) {
      router.push(`/quran/${quote.quran.surahNumber}/${quote.quran.ayahNumber}${tabQuery}`);
      onOpenChange(false);
      return;
    }
    router.push(`/hadith/${quote.id}${tabQuery}`);
    onOpenChange(false);
  }

  async function shareLink() {
    if (!quote || typeof window === 'undefined') return;
    const tabQuery = activeTab ? `?tab=${activeTab}` : '';
    const path = isVerse && quote.quran?.surahNumber && quote.quran?.ayahNumber
      ? `/${locale}/quran/${quote.quran.surahNumber}/${quote.quran.ayahNumber}${tabQuery}`
      : `/${locale}/hadith/${quote.id}${tabQuery}`;
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        showCloseButton={false}
        className={
          mobile
            ? 'flex h-[90vh] max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-none'
            : 'flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[480px]'
        }
      >
        <SheetHeader className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <SheetTitle className="min-w-0 flex-1 font-arabic-display text-lg">
              {title}
            </SheetTitle>
            <Button
              type="button"
              variant="ghost"
              tone="neutral"
              size="sm"
              iconOnly
              icon={<X aria-hidden />}
              aria-label={t('close')}
              onClick={() => onOpenChange(false)}
            />
          </div>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {tabItems.length > 0 && activeTab ? (
            <div className="border-b border-border px-4 py-3">
              <SegmentTabs
                aria-label={title}
                items={tabItems}
                value={activeTab}
                onValueChange={(value) => setTab(value as StudyTabId)}
                variant="underline"
                size="hugged"
              />
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {isLoading ? (
              <BrandLoader label={t('loading')} showLabel className="text-sm" />
            ) : isError ? (
              <QueryErrorState error={error} message={t('error')} onRetry={() => void refetch()} className="py-8" />
            ) : (
              <StudyReading rows={activeRows} />
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                tone="neutral"
                size="sm"
                iconOnly
                // Previous points back toward the start edge: ← in English, → in Arabic.
                icon={<ChevronLeft className="rtl:-scale-x-100" aria-hidden />}
                aria-label={t('previous')}
                disabled={!prevId}
                onClick={() => prevId && onNavigate?.(prevId)}
              />
              <Button
                type="button"
                variant="ghost"
                tone="neutral"
                size="sm"
                iconOnly
                // Next points forward, like DirectionalArrow: → in English, ← in Arabic.
                icon={<ChevronRight className="rtl:-scale-x-100" aria-hidden />}
                aria-label={t('next')}
                disabled={!nextId}
                onClick={() => nextId && onNavigate?.(nextId)}
              />
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                tone="neutral"
                size="sm"
                iconOnly
                icon={<Share2 aria-hidden />}
                aria-label={t('share')}
                onClick={() => void shareLink()}
              />
              <Button
                type="button"
                variant="ghost"
                tone="neutral"
                size="sm"
                iconOnly
                icon={<Maximize2 aria-hidden />}
                aria-label={t('expand')}
                onClick={expandFull}
              />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
