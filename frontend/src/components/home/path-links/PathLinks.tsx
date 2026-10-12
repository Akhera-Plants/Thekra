import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

const PATHS = [
  { href: '/sins', label: 'sinEntryLabel', line: 'sinEntryDescription' },
  { href: '/good-deeds', label: 'deedEntryLabel', line: 'deedEntryDescription' },
  { href: '/branches', label: 'branchEntryLabel', line: 'branchEntryDescription' },
] as const;

export async function PathLinks() {
  const t = await getTranslations('home');

  return (
    <nav aria-label={t('title')}>
      <ul className="grid gap-2 sm:grid-cols-3">
        {PATHS.map((path) => (
          <li key={path.href}>
            <Link
              href={path.href}
              className="home-press flex min-h-16 flex-col justify-center gap-1 rounded-xl bg-foreground/6 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="font-arabic-display text-xl leading-snug text-foreground md:text-2xl">
                {t(path.label)}
              </span>
              <span className="text-sm leading-relaxed text-muted-foreground">{t(path.line)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
