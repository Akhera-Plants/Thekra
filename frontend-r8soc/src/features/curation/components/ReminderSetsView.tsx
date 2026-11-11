'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ListOrdered, Pencil, Plus, Trash2 } from 'lucide-react';
import { z } from '@/lib/zod';
import { queryKeys } from '@/lib/query-keys';
import {
  adminCreateReminderSet,
  adminDeleteReminderSet,
  adminGetReminderSet,
  adminListReminderSets,
  adminSetReminderSetItems,
  adminUpdateReminderSet,
} from '@/lib/api/admin-reminder-sets';
import type { AdminReminderSetDto } from '@/lib/types/api';
import { ApiError } from '@/lib/types/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AdminDataTable, type ColumnDef } from './AdminDataTable';
import { PageHeader } from './kit/PageHeader';
import { RowActions } from './kit/RowActions';
import { StatusBadge } from './kit/StatusBadge';
import { formatCount } from './kit/format';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const setSchema = z.object({
  slug: z.string().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'kebab-case only'),
  titleAr: z.string().min(1).max(120),
  titleEn: z.string().min(1).max(120),
  sortOrder: z.coerce.number().int().min(0).max(1000),
  published: z.boolean(),
});
type SetFormValues = z.infer<typeof setSchema>;

function SetDialog({ existing, onClose }: { existing?: AdminReminderSetDto; onClose: () => void }) {
  const t = useTranslations('admin');
  const qc = useQueryClient();
  const form = useForm<z.input<typeof setSchema>, unknown, SetFormValues>({
    resolver: zodResolver(setSchema),
    defaultValues: {
      slug: existing?.slug ?? '',
      titleAr: existing?.titleAr ?? '',
      titleEn: existing?.titleEn ?? '',
      sortOrder: existing?.sortOrder ?? 0,
      published: existing?.published ?? false,
    },
  });
  const { mutate: save, isPending } = useMutation({
    mutationFn: (values: SetFormValues) =>
      existing ? adminUpdateReminderSet(existing.id, { ...values, slug: undefined }) : adminCreateReminderSet(values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.adminReminderSets.all });
      toast.success(t('reminderSets.saveSuccess'));
      onClose();
    },
    onError: () => toast.error(t('reminderSets.saveError')),
  });

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? t('reminderSets.editTitle') : t('reminderSets.newTitle')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => save(values))} className="flex flex-col gap-4" noValidate>
            <FormField
              control={form.control}
              name="titleAr"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('common.nameAr')}</FormLabel>
                  <FormControl>
                    <Input dir="rtl" className="font-arabic-ui" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="titleEn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('common.nameEn')}</FormLabel>
                  <FormControl>
                    <Input dir="ltr" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common.slug')}</FormLabel>
                    <FormControl>
                      <Input dir="ltr" placeholder="kebab-case" {...field} disabled={!!existing} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sortOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('reminderSets.sortOrder')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={1000}
                        name={field.name}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        value={String(field.value ?? '')}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="published"
              render={({ field }) => (
                <FormItem>
                  <label className="flex min-h-11 items-center gap-3 text-sm">
                    <input type="checkbox" className="size-4 accent-primary" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
                    {t('reminderSets.published')}
                  </label>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? t('common.saving') : t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/** The ordered quote ids of a set, one per line; the desk shows today's public texts beside them. */
function ItemsDialog({ set, onClose }: { set: AdminReminderSetDto; onClose: () => void }) {
  const t = useTranslations('admin');
  const qc = useQueryClient();
  const detail = useQuery({ queryKey: queryKeys.adminReminderSets.detail(set.id), queryFn: () => adminGetReminderSet(set.id) });
  const [text, setText] = useState(set.quoteIds.join('\n'));
  const [error, setError] = useState<string | null>(null);
  const ids = text
    .split(/[\s,]+/)
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);
  const { mutate: save, isPending } = useMutation({
    mutationFn: () => adminSetReminderSetItems(set.id, [...new Set(ids)]),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.adminReminderSets.all });
      toast.success(t('reminderSets.saveSuccess'));
      onClose();
    },
    onError: (err) =>
      setError(err instanceof ApiError && err.code === 'REMINDER_SET_QUOTE_NOT_ALLOWED' ? t('reminderSets.notAllowed') : t('reminderSets.saveError')),
  });
  const invalid = ids.filter((id) => !UUID.test(id));
  const shown = new Map((detail.data?.items ?? []).map((quote) => [quote.id, quote]));

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('reminderSets.itemsTitle', { title: set.titleAr })}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t('reminderSets.itemsHelp')}</p>
        <Textarea dir="ltr" rows={8} className="font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} />
        {invalid.length > 0 ? (
          <p className="text-sm text-destructive" role="alert">
            {t('reminderSets.invalidIds', { count: invalid.length })}
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <ol className="flex max-h-64 flex-col gap-2 overflow-y-auto text-sm">
          {set.quoteIds.map((id) => {
            const quote = shown.get(id);
            return (
              <li key={id} className="flex flex-col gap-1 border-b border-border pb-2">
                <code className="text-xs text-muted-foreground">{id}</code>
                {quote ? (
                  <span dir="rtl" lang="ar" className="line-clamp-2">
                    {quote.textAr}
                  </span>
                ) : (
                  <StatusBadge label={t('reminderSets.hidden')} tone="quiet" />
                )}
              </li>
            );
          })}
        </ol>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="button" disabled={isPending || invalid.length > 0} onClick={() => save()}>
            {isPending ? t('common.saving') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * «مجموعات التذكير» in the curation desk (redesign §4.6): sets of published texts for «نص اليوم» (widget, new tab,
 * app). Only published Quran verses and sahih/hasan hadith may be added; the API refuses anything else.
 */
export function ReminderSetsView() {
  const t = useTranslations('admin');
  const qc = useQueryClient();
  const [editing, setEditing] = useState<AdminReminderSetDto | 'new' | null>(null);
  const [itemsOf, setItemsOf] = useState<AdminReminderSetDto | null>(null);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: queryKeys.adminReminderSets.all, queryFn: adminListReminderSets });
  const sets = data ?? [];
  const { mutate: remove, isPending: isDeleting } = useMutation({
    mutationFn: adminDeleteReminderSet,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.adminReminderSets.all });
      toast.success(t('reminderSets.deleteSuccess'));
    },
    onError: () => toast.error(t('reminderSets.deleteError')),
  });

  const columns: ColumnDef<AdminReminderSetDto>[] = [
    {
      key: 'titleAr',
      header: t('common.nameAr'),
      cell: (row) => (
        <span className="font-medium" dir="rtl" lang="ar">
          {row.titleAr}
        </span>
      ),
    },
    { key: 'slug', header: t('common.slug'), cell: (row) => <code className="text-xs text-muted-foreground">{row.slug}</code> },
    { key: 'items', header: t('reminderSets.items'), cell: (row) => <span className="tabular-nums">{formatCount(row.itemCount)}</span> },
    {
      key: 'published',
      header: t('reminderSets.state'),
      cell: (row) => (
        <StatusBadge label={row.published ? t('reminderSets.published') : t('reminderSets.draft')} tone={row.published ? 'positive' : 'quiet'} />
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">{t('table.actions')}</span>,
      cell: (row) => (
        <RowActions
          label={t('table.actions')}
          primary={[
            { label: t('common.edit'), icon: Pencil, onSelect: () => setEditing(row) },
            { label: t('reminderSets.editItems'), icon: ListOrdered, onSelect: () => setItemsOf(row) },
          ]}
          destructive={{
            label: t('common.delete'),
            icon: Trash2,
            disabled: isDeleting,
            onSelect: () => remove(row.id),
            confirmTitle: t('common.confirmDelete'),
            confirmBody: row.titleAr,
            confirmLabel: t('common.delete'),
            cancelLabel: t('common.cancel'),
          }}
        />
      ),
      className: 'w-10',
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('reminderSets.title')}
        meta={isLoading ? undefined : formatCount(sets.length)}
        actions={
          <Button size="sm" className="desk-press" onClick={() => setEditing('new')}>
            <Plus data-icon="inline-start" aria-hidden />
            {t('reminderSets.newSet')}
          </Button>
        }
      />
      <p className="text-sm text-muted-foreground">{t('reminderSets.helper')}</p>
      <AdminDataTable
        columns={columns}
        data={sets}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        emptyMessage={t('reminderSets.empty')}
        rowKey={(row) => row.id}
      />
      {editing ? <SetDialog key={editing === 'new' ? 'new' : editing.id} existing={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} /> : null}
      {itemsOf ? <ItemsDialog key={itemsOf.id} set={itemsOf} onClose={() => setItemsOf(null)} /> : null}
    </div>
  );
}
