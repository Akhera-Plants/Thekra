'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { Check, ChevronDown, Plus, Undo2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  circleOf,
  deleteRelative,
  dueList,
  isRelativeOpen,
  limits,
  logContact,
  undoContact,
  updateRelative,
  type DueEntry,
  type PeopleCircle,
  type Relative,
} from '@thekra/practice-core';
import { Button } from '@/components/shared/kit/button';
import { TitleRow } from '@/components/shared/kit/title-row';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDigits } from '@/lib/format/digits';
import { formatGregorian } from '@/lib/practice/format';
import { langOf, rhythmOf } from '@/lib/practice/kinship';
import { limitOptions } from '@/lib/practice/limits';
import { updateStore } from '@/lib/practice/local-store';
import { useDeletesEverywhere } from '../../hooks/useDeletesEverywhere';
import type { WirdContext } from '../../hooks/useWirdContext';
import { LimitSheet } from '../LimitSheet';
import { RelativeForm } from '../RelativeForm';
import { RowMenu } from '../RowMenu';
import { cn } from '@/lib/utils';

/** The lists inside the act, in the owner's order (F-15 a). */
const SECTIONS: readonly PeopleCircle[] = ['kin', 'parents', 'neighbors', 'friends', 'sick'];

/**
 * The people of «صلة الرحم والأحباب» (round 6 §6, C-10 / C-01i): the round-5 people lists — الأقارب، الوالدان،
 * الجيران، الأصدقاء، المرضى — now live INSIDE this one periodic act on «الأعمال الدورية» (no page, menu entry or tab of
 * their own; `/practice/people` redirects here). Who is due this week (or overdue) is on top, across the lists. Each list
 * has «أضف» on its title line, opening a dialog (a toast after adding). A row logs «تواصلت» with an undo; like every
 * periodic row (C-24 a) it has «تعديل» as a link and a visible trash icon (delete asks first). `#circle-<key>` (an old link to one list) scrolls to that list.
 */
export function SilatPeople({ context }: { context: WirdContext }) {
  const t = useTranslations('practice.people');
  const tKin = useTranslations('practice.kinship');
  const { snapshot, today, habits } = context;
  const { store } = snapshot;
  const [adding, setAdding] = useState<PeopleCircle | null>(null);
  const [limitOpen, setLimitOpen] = useState<PeopleCircle | null>(null);
  const planLimits = useMemo(() => limits(store, today, limitOptions(habits)), [store, today, habits]);
  const open = store.relatives.filter(isRelativeOpen);
  const due = useMemo(() => {
    const list = dueList(open, today);
    return [...list.overdue, ...list.thisWeek];
  }, [open, today]);
  // The five lists stay folded under who is due (a long page on a phone); an old link to one list opens them.
  // (Rendered only on the device, after the store is read: `window` is there.)
  const [listsOpen, setListsOpen] = useState(() => store.relatives.length === 0 || window.location.hash.startsWith('#circle-'));
  const listsId = useId();
  useEffect(() => {
    const hash = window.location.hash.startsWith('#circle-') ? window.location.hash.slice(1) : null;
    if (hash) document.getElementById(hash)?.scrollIntoView({ block: 'start' });
  }, []);

  function startAdding(circle: PeopleCircle) {
    if (planLimits.canAdd('periodic', { circle })) setAdding(circle);
    else setLimitOpen(circle);
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="people-due" className="flex flex-col gap-2">
        <h4 id="people-due" className="text-base font-medium">
          {t('dueTitle')}
        </h4>
        {due.length === 0 ? (
          <p className="text-sm leading-7 text-muted-foreground">{store.relatives.length === 0 ? t('emptyAll') : t('dueNone')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border border-b border-border">
            {due.map((entry) => (
              <PersonRow key={entry.relative.id} entry={entry} today={today} showCircle />
            ))}
          </ul>
        )}
      </section>

      <button
        type="button"
        aria-expanded={listsOpen}
        aria-controls={listsId}
        onClick={() => setListsOpen((v) => !v)}
        className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-start text-base font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="flex-1">{t('listsToggle', { n: formatDigits(store.relatives.length) })}</span>
        <ChevronDown aria-hidden className={cn('size-4 transition-transform duration-150 motion-reduce:transition-none', listsOpen && 'rotate-180')} />
      </button>
      <div id={listsId} hidden={!listsOpen} className="flex flex-col gap-6">
        {SECTIONS.map((circle) => {
          const people = store.relatives.filter((r) => circleOf(r) === circle);
          // Who is due this week is listed once, on top; the list keeps the rest and says how many are up there.
          const list = dueList(people.filter(isRelativeOpen), today);
          const rows = list.later;
          const above = list.overdue.length + list.thisWeek.length;
          const visited = people.filter((r) => !isRelativeOpen(r));
          return (
            <section key={circle} id={`circle-${circle}`} aria-labelledby={`circle-${circle}-title`} className="flex scroll-mt-24 flex-col gap-2 border-t border-border pt-4">
              <TitleRow
                action={
                  <Button variant="outline" tone="primary" size="sm" icon={<Plus aria-hidden />} onClick={() => startAdding(circle)}>
                    {t('add')}
                  </Button>
                }
              >
                <h4 id={`circle-${circle}-title`} className="text-base font-medium">
                  {t(`sections.${circle}`)}
                </h4>
                <p className="text-sm leading-7 text-muted-foreground">{t(`hints.${circle}`)}</p>
              </TitleRow>
              {above > 0 ? <p className="text-sm text-muted-foreground">{t('above', { count: above, n: formatDigits(above) })}</p> : null}
              {rows.length === 0 && visited.length === 0 ? (
                above > 0 ? null : <p className="text-sm text-muted-foreground">{tKin('empty')}</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border border-b border-border">
                  {rows.map((entry) => (
                    <PersonRow key={entry.relative.id} entry={entry} today={today} />
                  ))}
                  {visited.map((relative) => (
                    <VisitedRow key={relative.id} relative={relative} />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <Dialog open={adding !== null} onOpenChange={(next) => (next ? undefined : setAdding(null))}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="pe-8">
            <DialogTitle className="leading-8">{adding ? t('addTo', { list: t(`sections.${adding}`) }) : null}</DialogTitle>
            <DialogDescription className="leading-7">{adding ? t(`hints.${adding}`) : null}</DialogDescription>
          </DialogHeader>
          {adding ? (
            <RelativeForm
              today={today}
              circle={adding}
              bare
              onAdded={(name) => {
                setAdding(null);
                toast.success(t('added', { name }));
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <LimitSheet
        kind="periodic"
        open={limitOpen !== null}
        onOpenChange={(next) => (next ? undefined : setLimitOpen(null))}
        limits={planLimits}
        store={store}
        habits={habits}
        today={today}
      />
    </div>
  );
}

function PersonRow({ entry, today, showCircle = false }: { entry: DueEntry; today: string; showCircle?: boolean }) {
  const t = useTranslations('practice.kinship');
  const tPeople = useTranslations('practice.people');
  const tDays = useTranslations('practice.weekdays');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const [editing, setEditing] = useState(false);
  const everywhere = useDeletesEverywhere();
  const { relative, nextDue, daysUntilDue } = entry;
  const circle = circleOf(relative);
  const preset = rhythmOf(relative.rule);
  const rhythm =
    circle === 'sick'
      ? null
      : preset
        ? preset.weekday === null
          ? t(`form.rhythms.${preset.rhythm}`)
          : t('rhythmOn', { rhythm: t(`form.rhythms.${preset.rhythm}`), day: tDays(`d${preset.weekday}`) })
        : t('rhythmCustom');
  const when =
    daysUntilDue < 0
      ? t('overdueBy', { count: -daysUntilDue, n: formatDigits(-daysUntilDue) })
      : daysUntilDue === 0
        ? t('dueToday')
        : formatGregorian(nextDue, locale, true);
  const contactedToday = relative.history.includes(today);
  const detail = [showCircle ? tPeople(`sections.${circle}`) : null, rhythm, when].filter(Boolean).join(' · ');
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-col">
          <p className="text-base font-medium break-words">
            <bdi lang={langOf(relative.name)}>{relative.name}</bdi>
            {relative.relation ? (
              <span className="text-sm font-normal text-muted-foreground">
                {' · '}
                <bdi lang={langOf(relative.relation)}>{relative.relation}</bdi>
              </span>
            ) : null}
          </p>
          <p className="text-sm leading-6 text-muted-foreground">{detail}</p>
        </div>
        <div className="flex items-center gap-2">
          {contactedToday ? (
            <Button variant="ghost" tone="neutral" size="sm" icon={<Undo2 aria-hidden />} onClick={() => updateStore((s) => undoContact(s, relative.id))}>
              {t('undo')}
            </Button>
          ) : (
            <Button
              variant="outline"
              tone="primary"
              size="sm"
              icon={<Check aria-hidden />}
              onClick={() => {
                updateStore((s) => updateRelative(s, relative.id, (r) => logContact(r, today)));
                toast.success(t('contactedToday'));
              }}
            >
              {circle === 'sick' ? tPeople('visited') : t('contacted')}
            </Button>
          )}
          <RowMenu
            inline
            label={tPeople('removeNamed', { name: relative.name })}
            edit={{ label: t('edit'), onSelect: () => setEditing(true) }}
            remove={{
              label: t('remove'),
              confirmTitle: tPeople('removeTitle', { name: relative.name }),
              note: everywhere ? t('removeNoteAccount') : t('removeNoteDevice'),
              confirm: t('removeConfirm'),
              keep: t('keep'),
              onConfirm: () => {
                updateStore((s) => deleteRelative(s, relative.id));
                toast.success(tPeople('removed', { name: relative.name }));
              },
            }}
          />
        </div>
      </div>
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="pe-8">
            <DialogTitle className="leading-8">{t('form.editTitle')}</DialogTitle>
            <DialogDescription className="leading-7">{relative.name}</DialogDescription>
          </DialogHeader>
          {editing ? (
            <RelativeForm
              today={today}
              relative={relative}
              bare
              onDone={() => {
                setEditing(false);
                toast.success(tPeople('saved'));
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </li>
  );
}

/** A sick person already visited: kept until removed (its «⋯»). */
function VisitedRow({ relative }: { relative: Relative }) {
  const t = useTranslations('practice.kinship');
  const tPeople = useTranslations('practice.people');
  return (
    <li className="flex min-h-12 items-center justify-between gap-3 py-2">
      <span className="flex flex-col">
        <bdi lang={langOf(relative.name)} className="text-base">
          {relative.name}
        </bdi>
        <span className="text-sm text-muted-foreground">{tPeople('visitedNote')}</span>
      </span>
      <RowMenu
        inline
        label={tPeople('removeNamed', { name: relative.name })}
        remove={{
          label: t('remove'),
          confirmTitle: tPeople('removeTitle', { name: relative.name }),
          confirm: t('removeConfirm'),
          keep: t('keep'),
          onConfirm: () => updateStore((s) => deleteRelative(s, relative.id)),
        }}
      />
    </li>
  );
}
