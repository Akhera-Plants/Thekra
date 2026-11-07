'use client';

import { useId, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { formatDigits } from '@/lib/format/digits';
import { groupNarrations } from '@/lib/texts/quote-text';
import type { QuoteDto } from '@/lib/types/api';
import { QuoteType } from '@/lib/types/enums';
import { cn } from '@/lib/utils';

interface NarrationItem {
  id: string;
  quote: QuoteDto;
}

const SAHIHAYN = /صحيح البخاري|صحيح مسلم/;

/** The kind a text is compared within: verses with verses, hadith with hadith, athar with athar. */
function kindOf(quote: QuoteDto): string {
  if (quote.type === QuoteType.HADITH) return quote.isAthar ? 'athar' : 'hadith';
  return quote.type;
}

/** The clearest wording leads: a Sahihayn text first, then the page's own order. */
function rankOf(quote: QuoteDto): number {
  return SAHIHAYN.test(quote.source?.nameAr ?? '') ? 0 : 1;
}

/**
 * A list of texts where narrations of the same text are shown once (W-08): the clearest wording, and under it
 * «وروي بألفاظ أخرى (n)» opening the other wordings in place. Grouping is conservative (lib/texts/quote-text.ts):
 * same wording, same sentences in another order, or one wording held whole in the other.
 */
export function NarrationList<T extends NarrationItem>({
  items,
  renderItem,
  className,
  'aria-label': ariaLabel,
}: {
  items: readonly T[];
  renderItem: (item: T) => ReactNode;
  className?: string;
  'aria-label'?: string;
}) {
  const groups = useMemo(
    () =>
      groupNarrations(
        items,
        (item) => ({ id: item.id, textAr: item.quote.textAr ?? '', kind: kindOf(item.quote) }),
        (item) => rankOf(item.quote),
      ),
    [items],
  );
  return (
    <ul aria-label={ariaLabel} className={cn('flex flex-col gap-8 md:gap-9', className)}>
      {groups.map((group) => (
        <li key={group.lead.id} className="flex flex-col gap-3">
          {renderItem(group.lead)}
          {group.others.length > 0 ? <OtherWordings items={group.others} renderItem={renderItem} /> : null}
        </li>
      ))}
    </ul>
  );
}

function OtherWordings<T extends NarrationItem>({ items, renderItem }: { items: T[]; renderItem: (item: T) => ReactNode }) {
  const t = useTranslations('quote');
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="flex flex-col gap-3 ps-3 md:ps-5">
      <button
        type="button"
        data-other-wordings={items.length}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg px-1 text-sm font-medium text-primary-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {t('otherWordings', { n: formatDigits(items.length) })}
        <ChevronDown
          aria-hidden
          className={cn('size-4 motion-safe:transition-transform motion-safe:duration-200', open && 'rotate-180')}
        />
      </button>
      <ul id={id} hidden={!open} className="flex flex-col gap-6 border-s-2 border-border ps-3 md:ps-5">
        {open ? items.map((item) => <li key={item.id}>{renderItem(item)}</li>) : null}
      </ul>
    </div>
  );
}
