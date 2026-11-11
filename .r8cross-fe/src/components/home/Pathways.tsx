import { Leaf } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { DoorArt } from './DoorArt';

/**
 * «أبواب الخير», the page's h1 (`#paths`), in the owner's order: «أعنّي على فعل طاعة» (the primary card) · «تخفّف من
 * معصية» · «شُعَب الإيمان». Round 6 (C-06): the three cards are the same size, each with the reference preview's line
 * drawing (leaf, arch-door, open book) in its corner behind the text (`DoorArt`); colours stay the site's. «مواسم الخير» is gone (round 5, F-17: the
 * occasions live in «سجلّي» and the «مناسبة قريبة» home section); `/names` redirects home (F-19 a).
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
          <DoorArt kind="leaf" className="door-art" />
          <span className="pathway-top">
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
          <DoorArt kind="arch" className="door-art" />
          <span className="pathway-top">
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
          <DoorArt kind="book" className="door-art" />
          <span className="pathway-top">
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
