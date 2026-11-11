'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { CatalogName } from '@/components/shared/CatalogName';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { Button } from '@/components/shared/kit/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getGoodDeeds } from '@/lib/api/good-deeds';
import { queryKeys } from '@/lib/query-keys';
import type { GoodDeedsQuery } from '@/lib/types/api';
import type { LocaleCode } from '@/lib/types/enums';

interface EasyDeedsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Good-deed topic slugs (catalog `mujahada.easyHighReward`). */
  slugs: readonly string[];
}

/**
 * «أتبِع السيئةَ الحسنة» / «أعمال سهلة»: easy deeds with a great reward (catalog `easyHighReward`), each opening its page.
 * The list of every good deed is one public request (the same for every visitor).
 */
export function EasyDeedsDialog({ open, onOpenChange, slugs }: EasyDeedsDialogProps) {
  const t = useTranslations('practice.strategies.goodDeeds');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const params = useMemo<GoodDeedsQuery>(() => ({ limit: 100, lang: locale as LocaleCode, includeEmpty: 'true' }), [locale]);
  const deeds = useQuery({
    queryKey: queryKeys.goodDeeds.list(params),
    queryFn: async () => (await getGoodDeeds(params)).data,
    enabled: open && slugs.length > 0,
    staleTime: 60 * 60 * 1000,
  });
  const bySlug = new Map((deeds.data ?? []).map((d) => [d.slug, d]));
  const shown = slugs.flatMap((slug) => bySlug.get(slug) ?? []);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('lead')}</DialogDescription>
        </DialogHeader>
        {shown.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {shown.map((deed) => (
              <li key={deed.slug}>
                <Button asChild variant="outline" tone="primary" className="h-auto min-h-11 w-full justify-between py-2 whitespace-normal">
                  <Link href={`/good-deeds/${deed.slug}`}>
                    <CatalogName nameAr={deed.nameAr} name={deed.name} />
                    <DirectionalArrow />
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">{deeds.isPending && slugs.length > 0 ? t('loading') : t('none')}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
