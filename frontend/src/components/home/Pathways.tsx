import { BookOpen, CalendarDays, DoorOpen, Leaf, Sprout } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';

/**
 * «أبواب الخير» (the header's «الأبواب» lands here, `#paths`): «المعاصي», «الطاعات», «شُعب الإيمان», and a fourth,
 * smaller door «مواسم الخير» (the occasions page, `/calendar`).
 */
export async function Pathways() {
  const t = await getTranslations('home');

  return (
    <section className="entry-section scroll-mt-6" id="paths" aria-labelledby="entry-title">
      <div className="intro-row">
        <div>
          <p className="eyebrow">
            <span className="tiny-sprout">
              <Leaf className="size-4" aria-hidden />
            </span>{' '}
            {t('eyebrow')}
          </p>
          <h2 id="entry-title" className="entry-title">
            {t('entryTitle')}
          </h2>
        </div>
      </div>

      <div className="pathways">
        <Link className="pathway pathway-return" href="/sins">
          <span className="pathway-top">
            <span className="pathway-icon">
              <DoorOpen className="size-7" aria-hidden />
            </span>
            <span className="pathway-overline">{t('sinOverline')}</span>
          </span>
          <span className="pathway-title">{t('sinEntryLabel')}</span>
          <span className="pathway-description">{t('sinEntryDescription')}</span>
          <span className="pathway-cta">
            {t('sinCta')}{' '}
            <span className="pathway-arrow">
              <DirectionalArrow className="size-[19px]" />
            </span>
          </span>
          <svg className="pathway-flourish" viewBox="0 0 150 160" fill="none" aria-hidden>
            <path
              d="M-10 149c62-23 83-63 91-134M48 100c-23 0-40-15-43-37 24-1 43 16 43 37Zm20-34c-13-13-15-37-5-55 20 16 18 38 5 55Zm-22 38c35 5 65-9 79-33-35-7-62 5-79 33Zm-20 27c20 6 53 3 72-13-27-13-52-8-72 13Z"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          </svg>
        </Link>

        <Link className="pathway pathway-good" href="/good-deeds">
          <span className="pathway-top">
            <span className="pathway-icon">
              <Sprout className="size-7" aria-hidden />
            </span>
            <span className="pathway-overline">{t('deedOverline')}</span>
          </span>
          <span className="pathway-title">{t('deedEntryLabel')}</span>
          <span className="pathway-description">{t('deedEntryDescription')}</span>
          <span className="pathway-cta">
            {t('deedCta')}{' '}
            <span className="pathway-arrow">
              <DirectionalArrow className="size-[19px]" />
            </span>
          </span>
        </Link>

        <Link className="pathway pathway-faith" href="/branches">
          <span className="pathway-top">
            <span className="pathway-icon">
              <BookOpen className="size-7" aria-hidden />
            </span>
            <span className="pathway-overline">{t('branchOverline')}</span>
          </span>
          <span className="pathway-title">{t('branchEntryLabel')}</span>
          <span className="pathway-description">{t('branchEntryDescription')}</span>
          <span className="pathway-cta">
            {t('branchCta')}{' '}
            <span className="pathway-arrow">
              <DirectionalArrow className="size-[19px]" />
            </span>
          </span>
        </Link>
      </div>

      <Link
        href="/calendar"
        className="group mt-4 flex min-h-14 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <CalendarDays aria-hidden className="size-6 shrink-0 text-intent-good-deed" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-lg font-medium">{t('seasonsTitle')}</span>
          <span className="text-sm leading-6 text-muted-foreground">{t('seasonsDescription')}</span>
        </span>
        <DirectionalArrow className="size-4 text-muted-foreground" />
      </Link>
    </section>
  );
}
