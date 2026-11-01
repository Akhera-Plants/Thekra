import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { CatalogName } from '@/components/shared/CatalogName';
import { FormattedNumber } from '@/components/shared/FormattedNumber';
import { QuoteCard, type QuoteCardIntent } from '@/components/shared/quote';
import { nameLinkHref } from '@/lib/api/names';
import type { ReaderHighlight } from '@/components/shared/editorial/ReminderReader';
import type { MizanDto } from '@/lib/types/api';

/** At most this many texts in «الميزان». */
const MIZAN_MAX = 2;

/**
 * «الميزان» for a topic reader: the same 1–2 texts, handed to the tabs (owner, 2026-11-01: every text sits under
 * «الكل · الآيات · الأحاديث»). Null when the API sends none.
 */
export function mizanHighlight(
  mizan: MizanDto | null | undefined,
  labels: { title: string; lead: string; top: string },
): ReaderHighlight | null {
  const items = mizan?.items.slice(0, MIZAN_MAX) ?? [];
  if (!mizan || items.length === 0) return null;
  return {
    title: labels.title,
    lead: mizan.source === 'top' ? labels.top : labels.lead,
    items: items.map((quote) => ({ id: quote.id, quote })),
  };
}

interface MizanBlockProps {
  mizan: MizanDto | null | undefined;
  intent: QuoteCardIntent;
  /** Replaces the default helper line (a name page says «آيةٌ ورد فيها هذا الاسم»). */
  lead?: string;
}

/**
 * «الميزان» as a block of its own (a name page, or a topic page without a reader): see {@link mizanHighlight} for the
 * topic pages' tabs. «الميزان» (redesign §4.5): 1–2 texts that state the weight — curated ids
 * (heart-texts.yaml), or the topic's top-ranked published text, said plainly as the first text of the page.
 * Hidden when the API sends none (older API, or no published text).
 */
export function MizanBlock({ mizan, intent, lead }: MizanBlockProps) {
  const t = useTranslations('topic');
  const items = mizan?.items.slice(0, MIZAN_MAX) ?? [];
  if (!mizan || items.length === 0) return null;
  return (
    <section aria-labelledby="mizan-title" className="flex flex-col gap-3">
      <h2 id="mizan-title" className="text-2xl font-medium">
        {t('mizanTitle')}
      </h2>
      <p className="text-sm leading-7 text-muted-foreground">{lead ?? (mizan.source === 'top' ? t('mizanTop') : t('mizanLead'))}</p>
      <ul className="flex flex-col gap-4">
        {items.map((quote) => (
          <li key={quote.id}>
            <QuoteCard quote={quote} intent={intent} detailHref={`/quotes/${quote.id}`} />
          </li>
        ))}
      </ul>
    </section>
  );
}

interface BranchLinksProps {
  branches: readonly { number: number; titleAr: string; title?: string | null }[] | undefined;
}

/** «من شعب الإيمان» on a sin or good-deed page: each branch the topic belongs to, as a link to its page. */
export function TopicBranchLinks({ branches }: BranchLinksProps) {
  const t = useTranslations('topic');
  const tBranches = useTranslations('branches');
  if (!branches || branches.length === 0) return null;
  return (
    <section aria-labelledby="topic-branches-title" className="flex flex-col gap-3">
      <h2 id="topic-branches-title" className="text-xl font-medium">
        {t('branchesTitle')}
      </h2>
      <ul className="flex flex-col">
        {branches.map((branch) => (
          <li key={branch.number} className="border-b border-border">
            <Link
              href={`/branches/${branch.number}`}
              className="flex min-h-12 min-w-0 items-center gap-3 py-2 text-intent-iman-branch focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="text-sm text-muted-foreground">
                <FormattedNumber value={branch.number} />
              </span>
              <CatalogName nameAr={branch.titleAr} name={branch.title || tBranches('branchFallback', { number: branch.number })} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface BranchRelatedProps {
  goodDeeds: readonly { slug: string; name: string; nameAr: string }[];
  sins: readonly { slug: string; name: string; nameAr: string }[];
}

/** On a branch page: the good deeds and sins this branch is linked to (ImanBranchGoodDeed / ImanBranchSin), as links. */
export function BranchRelatedLinks({ goodDeeds, sins }: BranchRelatedProps) {
  const t = useTranslations('topic');
  const tBranches = useTranslations('branches');
  if (goodDeeds.length === 0 && sins.length === 0) return null;
  const group = (title: string, items: BranchRelatedProps['goodDeeds'], base: '/good-deeds' | '/sins', tone: string) =>
    items.length > 0 ? (
      <div className="flex flex-col gap-2">
        <h3 className="text-base font-medium text-muted-foreground">{title}</h3>
        <ul className="flex flex-col">
          {items.map((item) => (
            <li key={item.slug} className="border-b border-border">
              <Link
                href={`${base}/${item.slug}`}
                className={`flex min-h-12 min-w-0 items-center py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${tone}`}
              >
                <CatalogName nameAr={item.nameAr} name={item.name} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    ) : null;
  return (
    <section aria-labelledby="branch-related-title" className="flex flex-col gap-4">
      <h2 id="branch-related-title" className="text-xl font-medium">
        {t('branchRelatedTitle')}
      </h2>
      {group(tBranches('goodDeeds'), goodDeeds, '/good-deeds', 'text-intent-good-deed')}
      {group(tBranches('sins'), sins, '/sins', 'text-intent-sin')}
    </section>
  );
}

interface NameLinksProps {
  links: readonly { kind: 'deed' | 'sin' | 'action'; slug: string; nameAr: string; name: string }[];
}

/** «التعبّد بهذا الاسم» on a name page (redesign §4.7): the topics and actions the name calls to, as links. */
export function NameWorshipLinks({ links }: NameLinksProps) {
  const t = useTranslations('names');
  if (links.length === 0) return null;
  const kindLabel = { deed: t('kindDeed'), sin: t('kindSin'), action: t('kindAction') } as const;
  const tone = { deed: 'text-intent-good-deed', sin: 'text-intent-sin', action: 'text-intent-good-deed' } as const;
  return (
    <section aria-labelledby="name-worship-title" className="flex flex-col gap-3">
      <h2 id="name-worship-title" className="text-xl font-medium">
        {t('worshipTitle')}
      </h2>
      <ul className="flex flex-col">
        {links.map((link) => (
          <li key={`${link.kind}:${link.slug}`} className="border-b border-border">
            <Link
              href={nameLinkHref(link)}
              className={`flex min-h-12 min-w-0 items-center gap-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${tone[link.kind]}`}
            >
              <span className="text-sm text-muted-foreground">{kindLabel[link.kind]}</span>
              <CatalogName nameAr={link.nameAr} name={link.name} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
