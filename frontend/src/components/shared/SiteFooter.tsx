import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { accountsEnabled } from '@/lib/accounts';

export async function SiteFooter() {
  const tApp = await getTranslations('app');
  const tNav = await getTranslations('nav');
  const tFooter = await getTranslations('footer');
  const showAccounts = accountsEnabled();

  return (
    <footer className="site-footer">
      <div className="footer-main page-width">
        <div className="footer-brand">
          <Link href="/" className="footer-logo">
            {tApp('name')} <span>{tApp('tagline')}</span>
          </Link>
          <p>
            {tFooter('blurbLine1')}
            <br />
            {tFooter('blurbLine2')}
          </p>
        </div>
        <nav className="footer-links" aria-labelledby="footer-paths">
          <h2 id="footer-paths">{tFooter('pathsHeading')}</h2>
          <Link href="/sins">{tNav('sinsShort')}</Link>
          <Link href="/good-deeds">{tNav('goodDeedsShort')}</Link>
          <Link href="/branches">{tNav('branches')}</Link>
          <Link href="/practice">{tNav('practiceLong')}</Link>
          <Link href="/practice/kinship">{tNav('kinship')}</Link>
          <Link href="/calendar">{tNav('calendar')}</Link>
        </nav>
        <nav className="footer-links" aria-labelledby="footer-about">
          <h2 id="footer-about">{tFooter('aboutHeading')}</h2>
          <Link href="/about">{tNav('about')}</Link>
          <Link href="/about#content-methodology">{tFooter('methodology')}</Link>
          {showAccounts ? <Link href="/favorites">{tNav('favorites')}</Link> : null}
        </nav>
      </div>
      <div className="footer-bottom page-width">
        <span>{tFooter('copyright')}</span>
        <span>{tFooter('sourceNote')}</span>
      </div>
    </footer>
  );
}
