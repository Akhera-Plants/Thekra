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
        </Link>
      </div>
    </section>
  );
}
