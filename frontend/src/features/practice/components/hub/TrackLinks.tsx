'use client';

import type { ReactNode } from 'react';
import { HeartHandshake, NotebookPen, Sprout } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { formatDigits } from '@/lib/format/digits';
import type { TrackSummary } from '@/lib/practice/hub';

interface TrackRowProps {
  href: string;
  icon: ReactNode;
  title: string;
  meta: string;
}

function TrackRow({ href, icon, title, meta }: TrackRowProps) {
  return (
    <li>
      <Link
        href={href}
        className="group flex min-h-14 items-center gap-3 rounded-xl px-2 py-3 transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary [&_svg]:size-[1.125rem]">
          {icon}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-base leading-7 font-medium">{title}</span>
          <span className="text-sm leading-6 text-muted-foreground">{meta}</span>
        </span>
        <DirectionalArrow className="size-4 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
      </Link>
    </li>
  );
}

/** The three tracks, each leading to its own page, with one quiet line of where it stands. */
export function TrackLinks({ summary }: { summary: TrackSummary }) {
  const t = useTranslations('practice.hub.tracks');
  const habitsMeta = [
    t('habitsCount', { count: summary.habits, n: formatDigits(summary.habits) }),
    summary.band ? t(`band.${summary.band}`) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const kinshipMeta =
    summary.relatives === 0
      ? t('kinshipEmpty')
      : t('kinshipDue', { count: summary.relativesDue, n: formatDigits(summary.relativesDue) });
  return (
    <section aria-labelledby="hub-tracks-title" className="flex flex-col gap-2">
      <h2 id="hub-tracks-title" className="text-xl font-medium">
        {t('title')}
      </h2>
      <ul className="flex flex-col divide-y divide-border border-y border-border">
        <TrackRow href="/practice/habits" icon={<Sprout />} title={t('habits')} meta={habitsMeta} />
        <TrackRow href="/practice/kinship" icon={<HeartHandshake />} title={t('kinship')} meta={kinshipMeta} />
        <TrackRow
          href="/practice/leave-sin"
          icon={<NotebookPen />}
          title={t('program')}
          meta={summary.hasProgram ? t('programActive') : t('programStart')}
        />
      </ul>
    </section>
  );
}

/** First visit: the three tracks as start choices, one line each. */
export function StartChoices() {
  const t = useTranslations('practice.hub.start');
  const choices = [
    { href: '/practice/habits', icon: <Sprout />, title: t('habits'), line: t('habitsLine') },
    { href: '/practice/kinship', icon: <HeartHandshake />, title: t('kinship'), line: t('kinshipLine') },
    { href: '/practice/leave-sin', icon: <NotebookPen />, title: t('program'), line: t('programLine') },
  ];
  return (
    <section aria-labelledby="hub-start-title" className="flex flex-col gap-2">
      <h2 id="hub-start-title" className="text-2xl font-medium">
        {t('title')}
      </h2>
      <p className="text-muted-foreground">{t('lead')}</p>
      <ul className="flex flex-col divide-y divide-border border-y border-border">
        {choices.map((choice) => (
          <TrackRow key={choice.href} href={choice.href} icon={choice.icon} title={choice.title} meta={choice.line} />
        ))}
      </ul>
    </section>
  );
}
