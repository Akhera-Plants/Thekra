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
import { useSins } from '@/features/sin-reminder/hooks/useSins';
import type { SinDto } from '@/lib/types/api';

interface SinSearchCommandProps {
  onSelect?: (sin: SinDto) => void;
}

/**
 * cmdk-powered sin search for the picker sheet.
 * Fetches all sins and provides fuzzy search over `nameAr` + `name`.
 */
export function SinSearchCommand({ onSelect }: SinSearchCommandProps) {
  const t = useTranslations('sins');
  const router = useRouter();
  const { data, isPending } = useSins({ limit: 200 });
  const sins = data?.data ?? [];

  function handleSelect(sin: SinDto) {
    if (onSelect) {
      onSelect(sin);
    } else {
      router.push(`/sins/${sin.slug}`);
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
          sins.map((sin) => (
            <CommandItem
              key={sin.id}
              value={`${sin.nameAr} ${sin.name}`}
              onSelect={() => handleSelect(sin)}
              className="flex items-center justify-between gap-3 cursor-pointer"
            >
              <ArabicText as="span" size="base">
                {sin.nameAr}
              </ArabicText>
              {sin.name && (
                <span className="shrink-0 text-sm text-muted-foreground">
                  {sin.name}
                </span>
              )}
            </CommandItem>
          ))}
      </CommandList>
    </Command>
  );
}
