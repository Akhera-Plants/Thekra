'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from '@/lib/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/query-keys';
import { adminCreateSource, adminUpdateSource, adminDeleteSource } from '@/lib/api/admin-sources';
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
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { QuoteSourceDto } from '@/lib/types/api';
import type { CatalogSource } from '@/lib/api/sources';
import { SourceType } from '@/lib/types/enums';
import { adminLabel, sourceName } from '@/lib/format/admin-labels';
import { getCatalogSources } from '@/lib/api/sources';
import { PageHeader } from './kit/PageHeader';
import { RowActions } from './kit/RowActions';
import { formatCount } from './kit/format';


const sourceSchema = z.object({
  name: z.string().min(1).max(300),
  nameAr: z.string().max(300).optional(),
  type: z.nativeEnum(SourceType),
  author: z.string().max(300).optional(),
  authorAr: z.string().max(300).optional(),
  isExternalApi: z.boolean().optional(),
  apiProvider: z.string().max(100).optional(),
});

type SourceFormValues = z.infer<typeof sourceSchema>;

interface SourceDialogProps {
  open: boolean;
  onClose: () => void;
  existing?: QuoteSourceDto;
}

function SourceDialog({ open, onClose, existing }: SourceDialogProps) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const isEdit = !!existing;
  const qc = useQueryClient();

  const { mutate: save, isPending } = useMutation({
    mutationFn: async (values: SourceFormValues) => {
      if (isEdit && existing) return adminUpdateSource(existing.id, values);
      return adminCreateSource(values);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.sources.all });
      void qc.invalidateQueries({ queryKey: queryKeys.adminSources.all });
      toast.success(t('sources.saveSuccess'));
      onClose();
    },
    onError: () => toast.error(t('sources.saveError')),
  });

  const form = useForm<SourceFormValues>({
    resolver: zodResolver(sourceSchema),
    defaultValues: {
      name: existing?.name ?? '',
      nameAr: existing?.nameAr ?? '',
      type: existing?.type ?? SourceType.BOOK,
      author: existing?.author ?? '',
      authorAr: existing?.authorAr ?? '',
      isExternalApi: existing?.isExternalApi ?? false,
      apiProvider: existing?.apiProvider ?? '',
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('sources.editTitle') : t('sources.newTitle')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => save(v))} className="flex flex-col gap-4" noValidate>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('common.nameEn')}</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="nameAr" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('common.nameAr')}</FormLabel>
                  <FormControl><Input dir="rtl" className="font-arabic-ui" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('common.type')}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.values(SourceType).map((v) => (
                        <SelectItem key={v} value={v}>{adminLabel('sourceType', v, locale)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="author" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('sources.fieldAuthor')}</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
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

export function SourceCrudView() {
  const t = useTranslations('admin');
  const locale = useLocale();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogSource | undefined>();
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [...queryKeys.sources.list({ limit: 100 }), 'catalog'],
    queryFn: () => getCatalogSources({ limit: 100 }),
  });
  const sources = data?.data ?? [];

  const { mutate: del, isPending: isDeleting } = useMutation({
    mutationFn: adminDeleteSource,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.sources.all });
      toast.success(t('sources.deleteSuccess'));
    },
    onError: () => toast.error(t('sources.deleteError')),
  });

  const allColumns: ColumnDef<CatalogSource>[] = [
    {
      key: 'nameAr',
      header: t('common.nameAr'),
      cell: (row) => row.nameAr
        ? <span className="font-medium" dir="rtl" lang="ar">{row.nameAr}</span>
        : <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'name',
      header: t('common.nameEn'),
      cell: (row) => <span className="text-sm">{row.name}</span>,
    },
    {
      key: 'type',
      header: t('common.type'),
      cell: (row) => <span className="text-muted-foreground">{adminLabel('sourceType', row.type, locale)}</span>,
    },
    {
      key: 'author',
      header: t('sources.fieldAuthor'),
      cell: (row) => (
        <span className="text-sm text-muted-foreground">{(locale === 'en' ? row.author : (row.authorAr ?? row.author)) ?? '—'}</span>
      ),
    },
    {
      key: 'counts',
      header: <span className="block text-end">{t('home.colImported')} · {t('home.colPublic')}</span>,
      className: 'w-40 whitespace-nowrap text-end tabular-nums',
      cell: (row) => (
        <span>
          <span className="text-muted-foreground">{formatCount(row.quoteCount)}</span>
          <span className="text-muted-foreground"> · </span>
          <span className="font-medium">{formatCount(row.publishedQuoteCount)}</span>
        </span>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">{t('table.actions')}</span>,
      cell: (row) => (
        <RowActions
          label={t('table.actions')}
          primary={[{ label: t('common.edit'), icon: Pencil, onSelect: () => { setEditing(row); setDialogOpen(true); } }]}
          destructive={{
            label: t('common.delete'),
            icon: Trash2,
            disabled: isDeleting,
            onSelect: () => del(row.id),
            confirmTitle: t('common.confirmDelete'),
            confirmBody: sourceName(row, locale),
            confirmLabel: t('common.delete'),
            cancelLabel: t('common.cancel'),
          }}
        />
      ),
      className: 'w-10',
    },
  ];

  // English names are data, edited in the dialog; the Arabic desk does not show them as a column.
  const columns = allColumns.filter((column) => locale === 'en' || column.key !== 'name');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('sources.title')}
        meta={isLoading ? undefined : formatCount(sources.length)}
        actions={
          <Button size="sm" className="desk-press" onClick={() => { setEditing(undefined); setDialogOpen(true); }}>
            <Plus data-icon="inline-start" aria-hidden />
            {t('sources.newSource')}
          </Button>
        }
      />
      <AdminDataTable columns={columns} data={sources} isLoading={isLoading} isError={isError}
        onRetry={() => void refetch()} emptyMessage={t('sources.empty')} rowKey={(r) => r.id} />
      <SourceDialog key={editing?.id ?? 'new'} open={dialogOpen} onClose={() => { setDialogOpen(false); setEditing(undefined); }} existing={editing} />
    </div>
  );
}
