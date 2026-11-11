import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AppStoreLinks } from '@/components/shared/AppStoreLinks';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatInviteCode, inviteAppLink, readInviteCode } from '@/lib/invite-code';

/**
 * The page a «صحبة» invite link opens (`/invite/<code>`, Arabic unprefixed, English under `/en`): who invited you is
 * never shown and the code is not looked up here (nothing about a circle leaks to anyone holding a link). It says what
 * the invite is, shows the code to type, and one button that opens the app on the invite (`thekra://circles/invite/…`).
 * Not indexed: an invite is personal.
 */
export async function generateMetadata({ params }: PageProps<'/[locale]/invite/[code]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'inviteLanding' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function InvitePage({ params }: PageProps<'/[locale]/invite/[code]'>) {
  const { locale, code: raw } = await params;
  setRequestLocale(locale);
  const code = readInviteCode(raw);
  if (!code) notFound();
  const t = await getTranslations('inviteLanding');

  return (
    <div className="page-width inner-page">
      <header className="page-heading">
        <h1 id="page-title" tabIndex={-1}>
          {t('title')}
        </h1>
        <p className="page-lead">{t('lead')}</p>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <section aria-labelledby="invite-code-label" className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5">
          <h2 id="invite-code-label" className="text-sm font-normal text-muted-foreground">
            {t('codeLabel')}
          </h2>
          <p dir="ltr" className="select-all text-center text-3xl font-semibold tracking-[0.18em] text-primary-text">
            {formatInviteCode(code)}
          </p>
        </section>

        <ol className="flex list-decimal flex-col gap-2 ps-5 text-base leading-7">
          <li>{t('stepGet')}</li>
          <li>{t('stepOpen')}</li>
        </ol>

        <div className="flex flex-col gap-3">
          <a href={inviteAppLink(code)} className={cn(buttonVariants({ size: 'lg' }), 'min-h-11 w-full')}>
            {t('open')}
          </a>
          <AppStoreLinks />
        </div>

        <p className="text-sm text-muted-foreground">{t('terms')}</p>
      </div>
    </div>
  );
}
