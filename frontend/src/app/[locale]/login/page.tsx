import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { AuthWhy } from '@/features/auth/components/AuthWhy';
import { AuthSwitchLink } from '@/features/auth/components/AuthSwitchLink';
import { LoginForm } from '@/features/auth/components/LoginForm';

interface LoginPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: LoginPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('loginTitle') };
}

export default async function LoginPage({ params }: LoginPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);


  const t = await getTranslations({ locale, namespace: 'auth' });

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-8 px-4 py-12">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-semibold">{t('loginTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('loginSubtitle')}</p>
        <AuthWhy />
      </div>

      <LoginForm />

      <p className="text-center text-sm text-muted-foreground">
        {t('noAccount')}{' '}
        <AuthSwitchLink
          to="/register"
          className="font-medium underline underline-offset-2 hover:opacity-80"
        >
          {t('register')}
        </AuthSwitchLink>
      </p>
    </div>
  );
}
