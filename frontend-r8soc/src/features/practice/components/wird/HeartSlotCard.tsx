'use client';

import { useMemo, useState } from 'react';
import { CalendarCheck, Check, HeartHandshake, MoonStar, Sunrise } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { heartSlot, type HeartSlot } from '@thekra/practice-core';
import { Button } from '@/components/shared/kit/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { limitOptions } from '@/lib/practice/limits';
import { EveningCard, IntentionCard, WeeklyCard, type HeartContext } from '../hub/HeartCards';
import { StoryLine } from '../hub/KnowledgeCards';

/**
 * The ONE heart card at the top of «ورد اليوم» (round 5, F-06 a / F-35 a / A-01 a): practice-core `heartSlot` picks it
 * by a fixed priority (the same on the app): «نية اليوم» in the morning, «محاسبة المساء» in its time, the weekly review on
 * its day, «عملك المعتاد يُكتب لك» the morning after an excuse. Each is one line; «ابدأ» opens its dialog, and a save
 * closes it with a toast. The made intention and the usual-deed line need no dialog.
 */
export function HeartSlotCard({ ctx }: { ctx: HeartContext }) {
  const t = useTranslations('practice.heartSlot');
  const tIntention = useTranslations('practice.heart.intention');
  const { heart, store, today, time, habits } = ctx;
  const slot = useMemo(() => heartSlot(heart, store, today, time, limitOptions(habits)), [heart, store, today, time, habits]);
  // The slot of the open dialog stays fixed while it is open (a save makes the live slot move on).
  const [open, setOpen] = useState<HeartSlot | null>(null);
  if (!slot && !open) return null;

  function saved(message: string) {
    setOpen(null);
    toast.success(message);
  }

  const line = slot ? <SlotLine slot={slot} onStart={() => setOpen(slot)} /> : null;

  return (
    <>
      {line}
      <Dialog open={open !== null} onOpenChange={(next) => (next ? undefined : setOpen(null))}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 sm:max-w-lg">
          {open ? (
            <>
              <DialogHeader className="pe-8">
                <DialogTitle className="leading-8">{t(`${open.kind === 'intention' ? 'intention' : open.kind}.title`)}</DialogTitle>
                <DialogDescription className="sr-only">{t(`${open.kind === 'intention' ? 'intention' : open.kind}.line`)}</DialogDescription>
              </DialogHeader>
              <div className="min-h-0 flex-1 overflow-y-auto pe-1">
                {open.kind === 'intention' ? (
                  <IntentionCard ctx={ctx} bare onSaved={(what) => (what === 'dismissed' ? setOpen(null) : saved(tIntention('made')))} />
                ) : open.kind === 'evening' ? (
                  <EveningCard ctx={ctx} bare onSaved={() => saved(t('evening.saved'))} />
                ) : open.kind === 'weekly' ? (
                  <WeeklyCard ctx={ctx} bare weekOf={open.weekOf} onSaved={() => saved(t('weekly.saved'))} />
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function SlotLine({ slot, onStart }: { slot: HeartSlot; onStart: () => void }) {
  const t = useTranslations('practice.heartSlot');
  const tIntention = useTranslations('practice.heart.intention');
  if (slot.kind === 'usual-deed') {
    return (
      <Row icon={<HeartHandshake />}>
        <StoryLine moment="heavyDay" compact label={t(`usual.${slot.reason}`)} />
      </Row>
    );
  }
  if (slot.kind === 'intention' && slot.state === 'made') {
    return (
      <Row icon={<Check />}>
        <p className="text-sm leading-7 text-muted-foreground">{tIntention('made')}</p>
      </Row>
    );
  }
  const key = slot.kind === 'intention' ? (slot.state === 'offer' ? 'offer' : 'intention') : slot.kind;
  const icon = slot.kind === 'intention' ? <Sunrise /> : slot.kind === 'evening' ? <MoonStar /> : <CalendarCheck />;
  return (
    <Row icon={icon}>
      <p className="min-w-0 flex-1 text-base leading-7">{t(`${key}.line`)}</p>
      <Button size="sm" onClick={onStart} className="shrink-0">
        {t('start')}
      </Button>
    </Row>
  );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
      <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary-text [&_svg]:size-[1.125rem]">
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
    </div>
  );
}
