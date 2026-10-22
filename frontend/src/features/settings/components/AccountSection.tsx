'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { UserDto } from '@/lib/api/auth';
import { useSession } from '@/features/auth/hooks/useSession';

interface AccountSectionProps {
  user: UserDto;
}

export function AccountSection({ user }: AccountSectionProps) {
  const t = useTranslations('settings');
  const tAuth = useTranslations('auth');
  const router = useRouter();
  const { clearSession } = useSession();

  async function handleLogout() {
    await clearSession();
    toast.success(tAuth('logoutSuccess'));
    router.push('/');
  }

  return (
    <section className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{t('account')}</p>
        <p className="truncate text-sm text-muted-foreground">{user.email}</p>
      </div>
      <Button variant="outline" size="sm" onClick={handleLogout}>
        {tAuth('logout')}
      </Button>
    </section>
  );
}
