import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export async function SiteFooter() {
  const tNav = await getTranslations('nav');

  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-3 px-4 py-6 text-sm text-muted-foreground">
        <Link
          href="/about"
          className="self-start underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {tNav('about')}
        </Link>
      </div>
    </footer>
  );
}
