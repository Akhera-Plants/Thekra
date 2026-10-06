'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { ArabicText } from '@/components/shared/ArabicText';
import { useGoodDeeds } from '@/features/good-deed-motivation/hooks/useGoodDeeds';
import type { GoodDeedDto } from '@/lib/types/api';

interface GoodDeedSearchCommandProps {
  onSelect?: (deed: GoodDeedDto) => void;
}

export function GoodDeedSearchCommand({ onSelect }: GoodDeedSearchCommandProps) {
  const t = useTranslations('goodDeeds');
  const router = useRouter();
  const { data, isPending } = useGoodDeeds({ limit: 100 });
  const deeds = data?.data ?? [];

  function handleSelect(deed: GoodDeedDto) {
    if (onSelect) {
      onSelect(deed);
    } else {
      router.push(`/good-deeds/${deed.slug}`);
    }
  }

  return (
    <Command
      filter={(value, search) => {
        const lower = search.toLowerCase();
        return value.includes(search) || value.toLowerCase().includes(lower)
          ? 1
          : 0;
      }}
    >
      <CommandInput
        placeholder={t('searchPlaceholder')}
        dir="rtl"
        aria-label={t('searchPlaceholder')}
        autoFocus
      />
      <CommandList>
        <CommandEmpty>{t('noResults')}</CommandEmpty>
        {!isPending &&
          deeds.map((deed) => (
            <CommandItem
              key={deed.id}
              value={`${deed.nameAr} ${deed.name}`}
              onSelect={() => handleSelect(deed)}
              className="flex items-center justify-between gap-3 cursor-pointer"
            >
              <ArabicText as="span" size="base">
                {deed.nameAr}
              </ArabicText>
              {deed.name && (
                <span className="shrink-0 text-sm text-muted-foreground">
                  {deed.name}
                </span>
              )}
            </CommandItem>
          ))}
      </CommandList>
    </Command>
  );
}
