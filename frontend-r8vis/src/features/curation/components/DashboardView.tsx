'use client';

/**
 * DashboardView — «ما ينتظرك الآن». One focal band (what needs the reviewer tonight),
 * then the library ledger, then topics that still lack texts.
 * Every number is a real count from an existing endpoint (meta.total of a limit=1 list).
 */

import { useTranslations } from 'next-intl';
import { useFlagCount, useLinkCount } from '../hooks/useAdminReview';
import { PageHeader } from './kit/PageHeader';
import { StatNumber } from './kit/StatNumber';
import { LibraryLedger } from './overview/LibraryLedger';
import { TopicsNeedingTexts } from './overview/TopicsNeedingTexts';
import { formatCount } from './kit/format';

export function DashboardView() {
  const t = useTranslations('admin.home');
  const high = useFlagCount({ status: 'OPEN', severity: 'HIGH' });
  const medium = useFlagCount({ status: 'OPEN', severity: 'MEDIUM' });
  const sinLinks = useLinkCount('sin', 'NOT_REVIEWED');
  const deedLinks = useLinkCount('good-deed', 'NOT_REVIEWED');
  const linksLoading = sinLinks.isLoading || deedLinks.isLoading;
  const linksError = sinLinks.isError || deedLinks.isError;

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-4">
        <PageHeader title={t('title')} description={t('description')} />
        <div className="grid grid-cols-1 divide-y divide-border rounded-xl border border-border md:grid-cols-3 md:divide-x md:divide-y-0">
          <StatNumber
            label={t('highFlags')}
            hint={t('highHint')}
            value={high.data}
            isLoading={high.isLoading}
            isError={high.isError}
            errorLabel={t('countError')}
            tone="danger"
            href="/admin/flags?severity=HIGH"
            className="rounded-none md:rounded-s-xl"
          />
          <StatNumber
            label={t('mediumFlags')}
            hint={t('mediumHint')}
            value={medium.data}
            isLoading={medium.isLoading}
            isError={medium.isError}
            errorLabel={t('countError')}
            href="/admin/flags?severity=MEDIUM"
            className="rounded-none"
          />
          <StatNumber
            label={t('proposals')}
            hint={
              linksLoading || linksError
                ? undefined
                : t('proposalsHint', {
                    sins: formatCount(sinLinks.data ?? 0),
                    deeds: formatCount(deedLinks.data ?? 0),
                  })
            }
            value={(sinLinks.data ?? 0) + (deedLinks.data ?? 0)}
            isLoading={linksLoading}
            isError={linksError}
            errorLabel={t('countError')}
            href="/admin/linking"
            className="rounded-none md:rounded-e-xl"
          />
        </div>
      </section>

      <LibraryLedger />
      <TopicsNeedingTexts />
    </div>
  );
}
