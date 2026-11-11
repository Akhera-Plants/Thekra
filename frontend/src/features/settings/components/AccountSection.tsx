'use client';

import { UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/shared/kit/button';
import type { UserDto } from '@/lib/api/auth';
import { useSession } from '@/features/auth/hooks/useSession';

interface AccountSectionProps {
  user: UserDto;
}

/** «الحساب» as a settings row: the icon, the name and the e-mail, «تسجيل الخروج» on the line's end. */
export function AccountSection({ user }: AccountSectionProps) {
  const t = useTranslations('settings');
  const tAuth = useTranslations('auth');
  const router = useRouter();
  const { clearSession } = useSession();

  async function handleLogout() {
    if ((await clearSession()) === 'unsynced') {
      toast.warning(tAuth('logoutUnsynced'));
      return;
    }
    toast.success(tAuth('logoutSuccess'));
    router.push('/');
  }

  return (
    <div className="flex min-h-14 items-center gap-3 py-1">
      <UserRound aria-hidden className="size-5 shrink-0 text-primary-text" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-base">{t('rows.account')}</span>
        <span className="truncate text-sm text-muted-foreground" dir="ltr">
          {user.email}
        </span>
      </span>
      <Button variant="outline" tone="neutral" size="sm" onClick={handleLogout}>
        {tAuth('logout')}
      </Button>
    </div>
  );
}
