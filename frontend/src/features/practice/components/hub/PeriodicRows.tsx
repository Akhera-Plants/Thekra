'use client';

import type { ReactNode } from 'react';
import { HeartHandshake, Repeat } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { addDays, type PeriodicAct, type Store } from '@thekra/practice-core';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { formatGregorian } from '@/lib/practice/format';
import { langOf } from '@/lib/practice/kinship';
import { habitOf } from '@/lib/practice/plans';
import { periodicHref } from '@/lib/practice/wird';
import type { PracticeHabit } from '@/lib/types/practice';
import { usePlanWords } from '../PlanCard';

interface PeriodicRowsProps {
  acts: readonly PeriodicAct[];
  store: Store;
  today: string;
  habits: ReadonlyMap<string, PracticeHabit>;
}

/**
 * Periodic acts as hairline rows: the name, a relative's relation (or «صلة الرحم») under it, and when it is next due
 * at the end. A relative opens the kinship page (its add and edit live there); a habit opens its plan.
 */
export function PeriodicRows({ acts, store, today, habits }: PeriodicRowsProps) {
  return (
    <ul className="flex flex-col divide-y divide-border border-y border-border">
      {acts.map((act) => {
        if (act.kind === 'relative') {
          const relative = store.relatives.find((r) => r.id === act.id);
          if (!relative) return null;
          return <RelativeLine key={`relative-${act.id}`} act={act} name={relative.name} relation={relative.relation} today={today} />;
        }
        const plan = store.plans.find((p) => p.id === act.id);
        if (!plan) return null;
        return <HabitLine key={`habit-${act.id}`} act={act} plan={plan} habit={habitOf(plan, habits)} today={today} />;
      })}
    </ul>
  );
}

function useWhen(next: string | null, today: string): string {
  const t = useTranslations('practice.periodic');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  if (next === null) return t('none');
  if (next < today) return t('overdue');
  if (next === today) return t('today');
  if (next === addDays(today, 1)) return t('tomorrow');
  return formatGregorian(next, locale);
}

interface LineProps {
  act: PeriodicAct;
  title: ReactNode;
  note: ReactNode;
  icon: ReactNode;
  today: string;
}

function Line({ act, title, note, icon, today }: LineProps) {
  const when = useWhen(act.next, today);
  return (
    <li>
      <Link
        href={periodicHref(act)}
        className="group flex min-h-14 items-center gap-3 rounded-xl px-2 py-2.5 transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary [&_svg]:size-[1.125rem]">
          {icon}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-base leading-7 font-medium break-words">{title}</span>
          <span className="text-sm leading-6 text-muted-foreground">{note}</span>
        </span>
        <span className="shrink-0 text-sm text-muted-foreground">{when}</span>
        <DirectionalArrow className="size-4 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100" />
      </Link>
    </li>
  );
}

function RelativeLine({ act, name, relation, today }: { act: PeriodicAct; name: string; relation: string; today: string }) {
  const t = useTranslations('practice.periodic');
  return (
    <Line
      act={act}
      today={today}
      icon={<HeartHandshake />}
      title={<bdi lang={langOf(name)}>{name}</bdi>}
      note={relation ? <bdi lang={langOf(relation)}>{relation}</bdi> : t('kinship')}
    />
  );
}

function HabitLine({
  act,
  plan,
  habit,
  today,
}: {
  act: PeriodicAct;
  plan: Store['plans'][number];
  habit: PracticeHabit | undefined;
  today: string;
}) {
  const t = useTranslations('practice.periodic');
  const words = usePlanWords(plan, habit);
  return (
    <Line
      act={act}
      today={today}
      icon={<Repeat />}
      title={
        <span lang={words.titleLang} dir={words.titleLang ? 'rtl' : undefined}>
          {words.title}
        </span>
      }
      note={t('habitNote')}
    />
  );
}
