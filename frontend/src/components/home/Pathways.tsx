import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { SiteIcon } from '@/components/shared/site-icons';

export async function Pathways() {
  const t = await getTranslations('home');

  return (
    <section className="entry-section" aria-labelledby="entry-title">
      <div className="intro-row">
        <div>
          <p className="eyebrow">
            <span className="tiny-sprout">
              <SiteIcon name="leaf" />
            </span>{' '}
            {t('eyebrow')}
          </p>
          <h1 id="entry-title">{t('entryTitle')}</h1>
        </div>
      </div>

      <div className="pathways" id="paths">
        <Link className="pathway pathway-return" href="/sins">
          <span className="pathway-top">
            <span className="pathway-icon">
              <SiteIcon name="door" />
            </span>
            <span className="pathway-overline">{t('sinOverline')}</span>
          </span>
          <span className="pathway-title">{t('sinEntryLabel')}</span>
          <span className="pathway-description">{t('sinEntryDescription')}</span>
          <span className="pathway-cta">
            {t('sinCta')}{' '}
            <span className="pathway-arrow">
              <SiteIcon name="arrow" />
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
              <SiteIcon name="sprout" />
            </span>
            <span className="pathway-overline">{t('deedOverline')}</span>
          </span>
          <span className="pathway-title">{t('deedEntryLabel')}</span>
          <span className="pathway-description">{t('deedEntryDescription')}</span>
          <span className="pathway-cta">
            {t('deedCta')}{' '}
            <span className="pathway-arrow">
              <SiteIcon name="arrow" />
            </span>
          </span>
        </Link>

        <Link className="pathway pathway-faith" href="/branches">
          <span className="pathway-top">
            <span className="pathway-icon">
              <SiteIcon name="book" />
            </span>
            <span className="pathway-overline">{t('branchOverline')}</span>
          </span>
          <span className="pathway-title">{t('branchEntryLabel')}</span>
          <span className="pathway-description">{t('branchEntryDescription')}</span>
          <span className="pathway-cta">
            {t('branchCta')}{' '}
            <span className="pathway-arrow">
              <SiteIcon name="arrow" />
            </span>
          </span>
        </Link>
      </div>
    </section>
  );
}
