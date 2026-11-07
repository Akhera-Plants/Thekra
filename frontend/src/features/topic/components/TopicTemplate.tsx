import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { CatalogName } from '@/components/shared/CatalogName';
import { FormattedNumber } from '@/components/shared/FormattedNumber';
import { QuoteCard, type QuoteCardIntent } from '@/components/shared/quote';
import type { QuoteDto } from '@/lib/types/api';

interface VerseBlockProps {
  quote: QuoteDto;
  title: string;
  intent: QuoteCardIntent;
}

/**
 * One text under its own heading (a name page's verse). «الميزان» is gone from every page (owner round 3, item 3);
 * the API field stays for older builds and is not rendered.
 */
export function VerseBlock({ quote, title, intent }: VerseBlockProps) {
  return (
    <section aria-labelledby="verse-block-title" className="flex flex-col gap-3">
      <h2 id="verse-block-title" className="text-xl font-medium">
        {title}
      </h2>
      <QuoteCard quote={quote} intent={intent} detailHref={`/quotes/${quote.id}`} />
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
