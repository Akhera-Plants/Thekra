'use client';

import type { ComponentProps, ReactNode } from 'react';
import { HeartHandshake, NotebookPen, Plus, Sprout } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AddItemProps {
  href: ComponentProps<typeof Link>['href'];
  icon: ReactNode;
  title: string;
  hint: string;
}

function AddItem({ href, icon, title, hint }: AddItemProps) {
  return (
    <DropdownMenuItem asChild className="items-start gap-3 rounded-lg px-2.5 py-2.5">
      <Link href={href}>
        <span aria-hidden className="mt-0.5 text-primary [&_svg]:size-[1.125rem]">
          {icon}
        </span>
        <span className="flex flex-col">
          <span className="text-sm font-medium">{title}</span>
          <span className="text-xs leading-5 text-muted-foreground">{hint}</span>
        </span>
      </Link>
    </DropdownMenuItem>
  );
}

/** «أضف»: a good habit (the setup wizard), a relative, or a private program (generic wording only). */
export function AddMenu() {
  const t = useTranslations('practice.hub.add');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="solid-button button-wrap !mt-0 !min-h-11" aria-label={t('label')}>
          <Plus aria-hidden className="!block" />
          {t('button')}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-1.5">
        <AddItem href={{ pathname: '/practice/habits', query: { add: '1' } }} icon={<Sprout />} title={t('habit')} hint={t('habitHint')} />
        <AddItem href="/practice/kinship" icon={<HeartHandshake />} title={t('relative')} hint={t('relativeHint')} />
        <AddItem href="/practice/leave-sin" icon={<NotebookPen />} title={t('program')} hint={t('programHint')} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
