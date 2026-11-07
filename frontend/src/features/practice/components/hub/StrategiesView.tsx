'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { setHeartPrefs, STRATEGIES, type Strategy } from '@thekra/practice-core';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/shared/kit/button';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { SegmentTabs, SegmentTabsContent } from '@/components/shared/kit/segment-tabs';
import { updateHeart } from '@/lib/practice/heart-store';
import { listedStrategies, strategyTarget } from '@/lib/practice/strategies';
import { usePracticeCatalog } from '../../hooks/usePracticeCatalog';
import { EasyDeedsDialog } from '../EasyDeedsDialog';
import { ConsistencyCard, HabitLoopCard, SinStepsCard } from './HabitCards';

type Tab = 'list' | 'cards';

/**
 * «استراتيجيات العادات» (redesign §4.5; owner round 3; round 5, F-12 a), the same page as the app
 * (mobile/app/practice/strategies.tsx): a library to read. The strategies themselves appear in their moment («ابدأ
 * صغيرًا» in «أضف», «اركب الموجة» in «لحظة مجاهدة», «اقضِ ما فاتك» in «صلّحها», «حاسب نفسك» in «محاسبتي»), so there is no
 * «ذكّرني بها», no weekly reminder and no loop builder here. Two tabs keep the page short (owner, 2026-11-03):
 * 1. «الاستراتيجيات» (first): practice-core `STRATEGIES` without «لا تفوّتها مرتين» (it appears the day after a missed
 *    habit, on its row), each a folded row: one idea line, its example and «جرّبها» (the page it maps to, from the shared
 *    navigation map; «أتبِع السيئةَ الحسنة» opens a short list of easy, high-reward good deeds instead);
 * 2. «قبل أن تبدأ»: the educational cards.
 */
export function StrategiesView() {
  const t = useTranslations('practice.strategies');
  const english = useLocale() === 'en';
  const catalog = usePracticeCatalog();
  const [tab, setTab] = useState<Tab>('list');
  const [deedsOpen, setDeedsOpen] = useState(false);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <SegmentTabs
        aria-label={t('tabsLabel')}
        items={[
          { value: 'list', label: t('listTitle') },
          { value: 'cards', label: t('cardsTitle') },
        ]}
        value={tab}
        onValueChange={(value) => setTab(value === 'cards' ? 'cards' : 'list')}
        className="gap-6"
      >
        <SegmentTabsContent value="list">
          <ul className="flex flex-col divide-y divide-border">
            {listedStrategies(STRATEGIES).map((strategy) => (
              <StrategyItem key={strategy.key} strategy={strategy} english={english} onDeeds={() => setDeedsOpen(true)} />
            ))}
          </ul>
        </SegmentTabsContent>
        <SegmentTabsContent value="cards" className="flex flex-col gap-4">
          <HabitLoopCard />
          <SinStepsCard withSource />
          <ConsistencyCard />
        </SegmentTabsContent>
      </SegmentTabs>

      <EasyDeedsDialog open={deedsOpen} onOpenChange={setDeedsOpen} slugs={catalog.data?.mujahada?.easyHighReward ?? []} />
    </div>
  );
}

/** One strategy as a folded row (owner, 2026-11-03: organise, don't stack text): opened, the idea, its example, «جرّبها». */
function StrategyItem({ strategy, english, onDeeds }: { strategy: Strategy; english: boolean; onDeeds: () => void }) {
  const t = useTranslations('practice.strategies');
  const target = strategyTarget(strategy.action);
  return (
    <li id={`strategy-${strategy.key}`}>
      <details className="group">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1 text-lg font-medium">{english ? strategy.titleEn : strategy.titleAr}</span>
          <ChevronDown aria-hidden className="size-5 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" />
        </summary>
        <div className="flex flex-col items-start gap-3 pb-5">
          <p className="text-base leading-8">{t(`items.${strategy.key}.idea`)}</p>
          <p className="text-sm leading-7 text-muted-foreground">{t(`items.${strategy.key}.example`)}</p>
          {strategy.key === 'follow-good' ? (
            <Button tone="primary" size="sm" aria-haspopup="dialog" onClick={onDeeds}>
              {t('try')}
            </Button>
          ) : (
            <Button asChild tone="primary" size="sm">
              <Link href={target.href} onClick={target.heart ? () => updateHeart((h) => setHeartPrefs(h, target.heart ?? {})) : undefined}>
                {t('try')} <DirectionalArrow />
              </Link>
            </Button>
          )}
        </div>
      </details>
    </li>
  );
}
