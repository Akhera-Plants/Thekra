'use client';

import { useTranslations } from 'next-intl';
import { CONSISTENCY_FACTS, HABIT_LOOP_STEPS, SIN_STEPS } from '@thekra/practice-core';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';

function Steps({ label, steps }: { label: string; steps: readonly string[] }) {
  return (
    <ol aria-label={label} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base leading-8">
      {steps.map((step, index) => (
        <li key={step} className="flex items-center gap-2">
          {index > 0 ? <DirectionalArrow className="size-4 text-muted-foreground" /> : null}
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}

/** «حلقة العادة»: تنبيه → نية → عمل صغير → قبول وفرح → تكرار (our wording). */
export function HabitLoopCard() {
  const t = useTranslations('practice.cards');
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5" aria-labelledby="loop-title">
      <h3 id="loop-title" className="text-lg font-medium">
        {t('loopTitle')}
      </h3>
      <Steps label={t('loopTitle')} steps={HABIT_LOOP_STEPS.map((k) => t(`loop.${k}`))} />
      <p className="text-sm leading-7 text-muted-foreground">{t('loopHint')}</p>
    </section>
  );
}

/**
 * How a sin grows: خاطرة → فكرة → شهوة → عزيمة → فعل → عادة. `withSource` adds the line naming Ibn al-Qayyim's «الفوائد»
 * — only on «استراتيجيات العادات», never in the main screens (redesign §1: no person's name in the main UI).
 */
export function SinStepsCard({ withSource = false }: { withSource?: boolean }) {
  const t = useTranslations('practice.cards');
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5" aria-labelledby="sin-steps-title">
      <h3 id="sin-steps-title" className="text-lg font-medium">
        {t('sinTitle')}
      </h3>
      <Steps label={t('sinTitle')} steps={SIN_STEPS.map((k) => t(`sin.${k}`))} />
      <p className="text-sm leading-7 text-muted-foreground">{t('sinHint')}</p>
      {withSource ? <p className="text-sm leading-7 text-muted-foreground">{t('sinSource')}</p> : null}
    </section>
  );
}

/** «الاستمرار: ثلاث حقائق». */
export function ConsistencyCard() {
  const t = useTranslations('practice.cards');
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5" aria-labelledby="consistency-title">
      <h3 id="consistency-title" className="text-lg font-medium">
        {t('consistencyTitle')}
      </h3>
      <ul className="flex list-disc flex-col gap-1 ps-5 text-base leading-8">
        {CONSISTENCY_FACTS.map((k) => (
          <li key={k}>{t(`facts.${k}`)}</li>
        ))}
      </ul>
    </section>
  );
}
