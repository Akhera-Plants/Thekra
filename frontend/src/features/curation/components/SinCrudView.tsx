'use client';

/**
 * SinCrudView — Sin CRUD table for admin.
 * Uses GET /admin/sins so the editorial severity score stays off the public API.
 */

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { queryKeys } from '@/lib/query-keys';
import { adminListSins } from '@/lib/api/admin-sins';
import { useAdminCreateSin, useAdminUpdateSin, useAdminDeleteSin } from '../hooks/useAdminSins';
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
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { AdminSinDto } from '@/lib/types/admin';
import { PageHeader } from './kit/PageHeader';
import { RowActions } from './kit/RowActions';
import { formatCount } from './kit/format';


const sinSchema = z.object({
  name: z.string().min(1).max(300),
  nameAr: z.string().min(1).max(300),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'kebab-case only'),
  category: z.string().max(100).optional(),
  severity: z.string().optional(),
  description: z.string().max(5000).optional(),
  descriptionAr: z.string().max(5000).optional(),
});

type SinFormValues = z.infer<typeof sinSchema>;

interface SinFormDialogProps {
  open: boolean;
  onClose: () => void;
  existing?: AdminSinDto;
}

function SinFormDialog({ open, onClose, existing }: SinFormDialogProps) {
  const t = useTranslations('admin');
  const isEdit = !!existing;
  const { mutateAsync: create, isPending: isCreating } = useAdminCreateSin();
  const { mutateAsync: update, isPending: isUpdating } = useAdminUpdateSin();
  const isPending = isCreating || isUpdating;

  const form = useForm<SinFormValues>({
    resolver: zodResolver(sinSchema),
    defaultValues: {
      name: existing?.name ?? '',
      nameAr: existing?.nameAr ?? '',
      slug: existing?.slug ?? '',
      category: existing?.category ?? '',
      severity: existing?.severity != null ? String(existing.severity) : '',
      description: existing?.description ?? '',
      descriptionAr: existing?.descriptionAr ?? '',
    },
  });

  async function onSubmit(values: SinFormValues) {
    const parsedSeverity = values.severity ? parseInt(values.severity, 10) : undefined;
    const body = {
      name: values.name,
      nameAr: values.nameAr,
      slug: values.slug,
      ...(values.category ? { category: values.category } : {}),
      ...(parsedSeverity ? { severity: parsedSeverity } : {}),
      ...(values.description ? { description: values.description } : {}),
      ...(values.descriptionAr ? { descriptionAr: values.descriptionAr } : {}),
    };
    if (isEdit && existing) {
      await update({ id: existing.id, body });
    } else {
      await create(body);
    }
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('sins.editTitle') : t('sins.newTitle')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
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
              <FormField control={form.control} name="slug" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('common.slug')}</FormLabel>
                  <FormControl><Input placeholder="kebab-case" {...field} disabled={isEdit} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="severity" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('sins.fieldSeverity')}</FormLabel>
                  <FormControl><Input type="number" min={1} max={10} placeholder="1–10" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('common.category')}</FormLabel>
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

export function SinCrudView() {
  const t = useTranslations('admin');
  const tRank = useTranslations('sinRank');
  const locale = useLocale();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminSinDto | undefined>();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.sins.list({ limit: 100 }),
    queryFn: () => adminListSins({ limit: 100 }),
  });
  const sins = data?.data ?? [];

  const { mutate: deleteSin, isPending: isDeleting } = useAdminDeleteSin();

  const allColumns: ColumnDef<AdminSinDto>[] = [
    {
      key: 'nameAr',
      header: t('common.nameAr'),
      cell: (row) => (
        <span className="flex items-baseline gap-2">
          <span dir="rtl" lang="ar" className="font-medium">{row.nameAr}</span>
          {row.rank ? <span className="text-xs text-muted-foreground">{tRank(row.rank)}</span> : null}
        </span>
      ),
    },
    {
      key: 'name',
      header: t('common.nameEn'),
      cell: (row) => <span className="text-sm">{row.name}</span>,
    },
    {
      key: 'slug',
      header: t('common.slug'),
      cell: (row) => <code className="text-xs text-muted-foreground">{row.slug}</code>,
    },
    {
      key: 'severity',
      header: t('sins.fieldSeverity'),
      cell: (row) => <span className="tabular-nums text-muted-foreground">{row.severity != null ? formatCount(row.severity) : '—'}</span>,
      className: 'w-20',
    },
    {
      key: 'quoteCount',
      header: t('quotesDesk.title'),
      cell: (row) => (
        <span className={row.quoteCount === 0 ? 'font-medium text-destructive tabular-nums' : 'tabular-nums'}>
          {formatCount(row.quoteCount)}
        </span>
      ),
      className: 'w-20',
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
            onSelect: () => deleteSin({ id: row.id }),
            confirmTitle: t('common.confirmDelete'),
            confirmBody: row.nameAr,
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
        title={t('sins.title')}
        meta={isLoading ? undefined : formatCount(sins.length)}
        actions={
          <Button size="sm" className="desk-press" onClick={() => { setEditing(undefined); setDialogOpen(true); }}>
            <Plus data-icon="inline-start" aria-hidden />
            {t('sins.newSin')}
          </Button>
        }
      />

      <AdminDataTable
        columns={columns}
        data={sins}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        emptyMessage={t('sins.empty')}
        rowKey={(r) => r.id}
      />

      <SinFormDialog
        key={editing?.id ?? 'new'}
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(undefined); }}
        existing={editing}
      />
    </div>
  );
}
