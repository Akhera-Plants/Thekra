'use client';

/**
 * LinkingView — «الربط المقترح»: the proposals queue first (what waits for a verdict),
 * the existing manual linking workspace as the second tab. State lives in the URL.
 */

import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUrlState } from '../hooks/useUrlState';
import { LinkingWorkspace } from './LinkingWorkspace';
import { PageHeader } from './kit/PageHeader';
import { ProposalsQueue, type ProposalKind } from './linking/ProposalsQueue';

const URL_KEYS = ['tab', 'kind', 'sin'] as const;

export function LinkingView() {
  const t = useTranslations('admin.proposals');
  const [url, setUrl] = useUrlState(URL_KEYS);
  const tab = url.tab === 'manual' ? 'manual' : 'queue';
  const kind: ProposalKind = url.kind === 'good-deed' ? 'good-deed' : 'sin';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('title')} description={t('description')} />
      <Tabs value={tab} onValueChange={(value) => setUrl({ tab: value === 'manual' ? 'manual' : null })}>
        <TabsList variant="line">
          <TabsTrigger value="queue">{t('queue')}</TabsTrigger>
          <TabsTrigger value="manual">{t('manual')}</TabsTrigger>
        </TabsList>
        <TabsContent value="queue" className="pt-4">
          <ProposalsQueue kind={kind} onKindChange={(next) => setUrl({ kind: next === 'sin' ? null : next })} />
        </TabsContent>
        <TabsContent value="manual" className="pt-4">
          <LinkingWorkspace initialSinId={url.sin ?? ''} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
