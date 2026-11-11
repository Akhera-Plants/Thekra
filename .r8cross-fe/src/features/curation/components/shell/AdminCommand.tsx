'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useRouter } from '@/i18n/navigation';
import { adminGetQuotes } from '@/lib/api/admin-quotes';
import { adminLabel, sourceName } from '@/lib/format/admin-labels';
import { splitMatn } from '@/lib/format/isnad';
import { queryKeys } from '@/lib/query-keys';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { ADMIN_NAV_ITEMS } from './admin-nav';

export interface AdminCommandProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * ⌘K: jump to any desk page, or find a text by its matn. No open/close animation beyond
 * the dialog primitive's own — this is used many times a night (emil-design-eng).
 */
export function AdminCommand({ open, onOpenChange }: AdminCommandProps) {
  const t = useTranslations('admin.command');
  const tShell = useTranslations('admin.shell');
  const locale = useLocale();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim(), 300);
  const query = { q, limit: 8 };

  const texts = useQuery({
    queryKey: queryKeys.adminQuotes.list(query),
    queryFn: () => adminGetQuotes(query),
    enabled: open && q.length >= 2,
  });

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onOpenChange(!open);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  function go(href: string) {
    onOpenChange(false);
    setSearch('');
    router.push(href);
  }

  const rows = q.length >= 2 ? (texts.data?.data ?? []) : [];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title={t('title')} description={t('description')}>
      <Command>
        <CommandInput value={search} onValueChange={setSearch} placeholder={t('placeholder')} />
        <CommandList>
          <CommandEmpty>{texts.isFetching ? t('searching') : t('noResults')}</CommandEmpty>
          <CommandGroup heading={t('pages')}>
            {ADMIN_NAV_ITEMS.map((item) => (
              <CommandItem key={item.key} value={`page ${tShell(item.key)}`} onSelect={() => go(item.href)}>
                <item.icon aria-hidden />
                {tShell(item.key)}
              </CommandItem>
            ))}
          </CommandGroup>
          {q.length >= 2 ? (
            <CommandGroup heading={t('texts')}>
              <CommandItem value={`search-all ${q}`} onSelect={() => go(`/admin/quotes?q=${encodeURIComponent(q)}`)}>
                <Search aria-hidden />
                {t('searchAll', { q })}
              </CommandItem>
              {rows.map((row) => (
                <CommandItem
                  key={row.id}
                  value={`text ${row.id} ${q}`}
                  onSelect={() => go(`/admin/quotes?q=${encodeURIComponent(q)}&open=${row.id}`)}
                  className="flex-col items-start gap-0.5"
                >
                  <span dir="rtl" lang="ar" className="line-clamp-1 font-arabic-text text-sm">
                    {splitMatn(row.textAr).matn}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {adminLabel('quoteType', row.type, locale)} · {sourceName(row.source, locale)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
