'use client';

/**
 * SyncConsoleView — trigger content-sync runs and watch SyncLogs.
 * Polls every 5 seconds while a run might be in progress.
 */

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { queryKeys } from '@/lib/query-keys';
import { getSources } from '@/lib/api/sources';
import { useAdminSyncLogs, useAdminTriggerSync } from '../hooks/useAdminSync';
import { AdminDataTable, type ColumnDef } from './AdminDataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RefreshCcw, Play } from 'lucide-react';
import type { SyncLogDto } from '@/lib/types/admin';
import type { SyncStatus } from '@/lib/types/enums';
import { cn } from '@/lib/utils';
import { adminLabel, sourceName } from '@/lib/format/admin-labels';
import { formatDigits } from '@/lib/format/digits';
import { PageHeader } from './kit/PageHeader';
import { StatusBadge, SYNC_STATUS_TONE } from './kit/StatusBadge';
import { formatCount } from './kit/format';

const triggerSchema = z.object({
  sourceId: z.string().uuid({ message: 'Select a source' }),
  dryRun: z.boolean().optional(),
  force: z.boolean().optional(),
  surahFrom: z.string().optional(),
  surahTo: z.string().optional(),
  collection: z.string().max(100).optional(),
});

type TriggerFormValues = z.infer<typeof triggerSchema>;

interface TriggerDialogProps {
  open: boolean;
  onClose: () => void;
}

function TriggerDialog({ open, onClose }: TriggerDialogProps) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const { mutateAsync: trigger, isPending } = useAdminTriggerSync();

  const { data: sourcesResult } = useQuery({
    queryKey: queryKeys.sources.list({}),
    queryFn: () => getSources({ limit: 100 }),
  });
  const externalSources = (sourcesResult?.data ?? []).filter((s) => s.isExternalApi);

  const form = useForm<TriggerFormValues>({
    resolver: zodResolver(triggerSchema),
    defaultValues: {
      sourceId: '',
      dryRun: false as boolean | undefined,
      force: false as boolean | undefined,
      surahFrom: '',
      surahTo: '',
      collection: '',
    },
  });

  async function onSubmit(values: TriggerFormValues) {
    const parsedSurahFrom = values.surahFrom ? parseInt(values.surahFrom, 10) : undefined;
    const parsedSurahTo = values.surahTo ? parseInt(values.surahTo, 10) : undefined;

    await trigger({
      sourceId: values.sourceId,
      dryRun: values.dryRun,
      force: values.force,
      scope: {
        ...(parsedSurahFrom ? { surahFrom: parsedSurahFrom } : {}),
        ...(parsedSurahTo ? { surahTo: parsedSurahTo } : {}),
        ...(values.collection ? { collection: values.collection } : {}),
      },
    });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('sync.triggerTitle')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            <FormField control={form.control} name="sourceId" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('sync.fieldSource')}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('sync.selectSource')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {externalSources.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {sourceName(s, locale)} {s.apiProvider && <span className="text-muted-foreground">({s.apiProvider})</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid gap-4 md:grid-cols-2">
              <FormField control={form.control} name="surahFrom" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('sync.fieldSurahFrom')}</FormLabel>
                  <FormControl><Input type="number" min={1} max={114} placeholder="1" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="surahTo" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('sync.fieldSurahTo')}</FormLabel>
                  <FormControl><Input type="number" min={1} max={114} placeholder="114" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="collection" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>{t('sync.fieldCollection')}</FormLabel>
                  <FormControl><Input placeholder="bukhari" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="rounded border border-input"
                  {...form.register('dryRun')}
                />
                {t('sync.dryRun')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="rounded border border-input"
                  {...form.register('force')}
                />
                {t('sync.force')}
              </label>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? t('sync.triggering') : t('sync.trigger')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function SyncConsoleView() {
  const t = useTranslations('admin');
  const locale = useLocale();
  const dateFormat = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'ar', {
    dateStyle: 'medium',
    timeStyle: 'short',
    numberingSystem: 'latn',
  });
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading, isError, refetch, isFetching } = useAdminSyncLogs({});
  const logs = data?.data ?? [];

  const columns: ColumnDef<SyncLogDto>[] = [
    {
      key: 'source',
      header: t('sync.colSource'),
      cell: (row) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium">{row.source.name}</span>
          {row.source.apiProvider && (
            <span className="text-xs text-muted-foreground">{row.source.apiProvider}</span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: t('sync.colStatus'),
      cell: (row) => (
        <StatusBadge
          tone={SYNC_STATUS_TONE[row.status as SyncStatus] ?? 'neutral'}
          label={adminLabel('syncStatus', row.status, locale)}
        />
      ),
      className: 'whitespace-nowrap',
    },
    {
      key: 'started',
      header: t('sync.colStarted'),
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {dateFormat.format(new Date(row.startedAt))}
        </span>
      ),
    },
    {
      key: 'duration',
      header: t('sync.colDuration'),
      cell: (row) =>
        row.durationMs != null ? (
          <span className="text-sm tabular-nums">{formatDigits((row.durationMs / 1000).toFixed(1))}{locale === 'en' ? 's' : ' ث'}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'imported',
      header: t('sync.colImported'),
      cell: (row) => <span className="tabular-nums">{formatCount(row.recordsImported)}</span>,
      className: 'w-20',
    },
    {
      key: 'error',
      header: t('sync.colError'),
      cell: (row) =>
        row.errorMessage ? (
          <span className="max-w-xs truncate text-xs text-destructive" title={row.errorMessage}>
            {row.errorMessage}
          </span>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('sync.title')}
        description={t('sync.subtitle')}
        actions={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isFetching}
            aria-label={t('sync.refresh')}
          >
            <RefreshCcw className={cn('h-4 w-4', isFetching && 'animate-spin')} aria-hidden />
          </Button>
          <Button size="sm" className="desk-press" onClick={() => setDialogOpen(true)}>
            <Play data-icon="inline-start" aria-hidden />
            {t('sync.triggerRun')}
          </Button>
        </>
        }
      />

      <AdminDataTable
        columns={columns}
        data={logs}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        emptyMessage={t('sync.empty')}
        rowKey={(r) => r.id}
      />

      <TriggerDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
