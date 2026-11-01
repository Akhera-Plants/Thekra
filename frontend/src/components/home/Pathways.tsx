import { BookOpen, DoorOpen, Leaf, Sprout } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';

/**
 * «أبواب الخير», the page's h1 (`#paths`), in the owner's order: «أعنّي على فعل طاعة» (the primary card) · «أعنّي على
 * ترك معصية» · «شُعَب الإيمان» (with a branching tree, its own drawing). «مواسم الخير» is not on the home (owner,
 * 2026-11-01): it is reached from the footer and «ورد اليوم». «الأسماء الحسنى» is hidden for now; `/names` still
 * answers but nothing links to it.
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
          <h1 id="entry-title" className="entry-title">
            {t('entryTitle')}
          </h1>
        </div>
      </div>

      <div className="pathways">
        <Link className="pathway pathway-primary" href="/good-deeds">
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
          <svg className="pathway-flourish" viewBox="0 0 150 160" fill="none" aria-hidden>
            <path
              d="M-10 149c62-23 83-63 91-134M48 100c-23 0-40-15-43-37 24-1 43 16 43 37Zm20-34c-13-13-15-37-5-55 20 16 18 38 5 55Zm-22 38c35 5 65-9 79-33-35-7-62 5-79 33Zm-20 27c20 6 53 3 72-13-27-13-52-8-72 13Z"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          </svg>
        </Link>

        <Link className="pathway pathway-soft" href="/sins">
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
          <svg className="pathway-flourish pathway-tree" viewBox="0 0 150 160" fill="none" aria-hidden>
            <path
              d="M75 170V40M75 128c-16-12-35-14-52-8M75 128c16-12 35-14 52-8M75 104c-12-13-17-30-14-47M75 104c12-13 17-30 14-47M75 78c-10-9-24-11-36-6M75 78c10-9 24-11 36-6M75 58c-5-8-6-17-4-26M75 58c5-8 6-17 4-26"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <path
              d="M23 120c-5-6-4-12 2-15 3 6 2 11-2 15Zm104 0c5-6 4-12-2-15-3 6-2 11 2 15ZM61 57c-6-4-7-10-3-14 5 4 6 9 3 14Zm28 0c6-4 7-10 3-14-5 4-6 9-3 14ZM39 72c-6-2-8-8-5-12 5 2 7 7 5 12Zm72 0c6-2 8-8 5-12-5 2-7 7-5 12ZM71 32c-4-5-3-11 1-14 4 5 3 10-1 14Zm8 0c4-5 3-11-1-14-4 5-3 10 1 14Z"
              stroke="currentColor"
              strokeWidth="1.1"
            />
          </svg>
        </Link>
      </div>
    </section>
  );
}
