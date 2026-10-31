'use client';

import { useLocale, useTranslations } from 'next-intl';
import { setHeartPrefs, STRATEGIES, toggleStrategy, type NotificationPrefs, type Strategy } from '@thekra/practice-core';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { updateHeart } from '@/lib/practice/heart-store';
import { notificationPrefsOf, updatePrefs } from '@/lib/practice/local-store';
import { strategyTarget } from '@/lib/practice/strategies';
import { resendPushPrefs } from '@/lib/push/web-push';
import { useWirdContext } from '../../hooks/useWirdContext';
import { PracticeLoading } from '../PracticeLoading';
import { ConsistencyCard, HabitLoopCard, SinStepsCard } from './HabitCards';

/**
 * «استراتيجيات العادات» (redesign §4.5), reached from «سجلّي»: the two educational cards (the sin progression with its
 * source line, only here) and «الاستمرار: ثلاث حقائق», then the fourteen strategies: one idea line, one example,
 * «جرّبها» (the feature it maps to) and «ذكّرني بها» (opt-in; at most one reminder a week, practice-core
 * `notificationPlan` kind `strategy`, sent with this browser's push switches).
 */
export function StrategiesView() {
  const t = useTranslations('practice.strategies');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const context = useWirdContext();
  if (!context) return <PracticeLoading />;
  const notify = notificationPrefsOf(context.snapshot.prefs);

  function setNotify(patch: Partial<NotificationPrefs>) {
    updatePrefs((p) => ({ ...p, notify: { ...notificationPrefsOf(p), ...patch } }));
    void resendPushPrefs(locale);
  }

  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <section aria-labelledby="strategy-cards-title" className="flex flex-col gap-4">
        <h2 id="strategy-cards-title" className="text-xl font-medium">
          {t('cardsTitle')}
        </h2>
        <HabitLoopCard />
        <SinStepsCard withSource />
        <ConsistencyCard />
      </section>

      <section aria-labelledby="strategy-list-title" className="flex flex-col gap-3">
        <h2 id="strategy-list-title" className="text-xl font-medium">
          {t('title')}
        </h2>
        <p className="text-sm leading-7 text-muted-foreground">{t('remindHint')}</p>
        <ol className="flex flex-col divide-y divide-border border-y border-border">
          {STRATEGIES.map((strategy) => (
            <StrategyRow
              key={strategy.key}
              strategy={strategy}
              english={locale === 'en'}
              reminding={notify.strategies.includes(strategy.key)}
              onRemind={() => setNotify({ strategies: toggleStrategy(notify.strategies, strategy.key) })}
            />
          ))}
        </ol>
      </section>
    </div>
  );
}

function StrategyRow({
  strategy,
  english,
  reminding,
  onRemind,
}: {
  strategy: Strategy;
  english: boolean;
  reminding: boolean;
  onRemind: () => void;
}) {
  const t = useTranslations('practice.strategies');
  const target = strategyTarget(strategy.action);
  return (
    <li id={`strategy-${strategy.key}`} className="flex flex-col gap-2 py-4">
      <h3 className="text-lg font-medium">{english ? strategy.titleEn : strategy.titleAr}</h3>
      <p className="text-base leading-8">{t(`items.${strategy.key}.idea`)}</p>
      <p className="text-sm leading-7 text-muted-foreground">{t(`items.${strategy.key}.example`)}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={target.href}
          className="outline-button button-wrap !mt-0 !min-h-11"
          onClick={target.heart ? () => updateHeart((h) => setHeartPrefs(h, target.heart ?? {})) : undefined}
        >
          {t('try')} <DirectionalArrow />
        </Link>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-primary" checked={reminding} onChange={onRemind} />
          {t('remind')}
        </label>
      </div>
    </li>
  );
}
