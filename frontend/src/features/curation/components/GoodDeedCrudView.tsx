'use client';

/**
 * GoodDeedCrudView — GoodDeed CRUD table for admin.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { queryKeys } from '@/lib/query-keys';
import { getGoodDeeds } from '@/lib/api/good-deeds';
import { getSins } from '@/lib/api/sins';
import {
  useAdminCreateGoodDeed,
  useAdminUpdateGoodDeed,
  useAdminDeleteGoodDeed,
} from '../hooks/useAdminGoodDeeds';
import { AdminDataTable, type ColumnDef } from './AdminDataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { ArabicText } from '@/components/shared/ArabicText';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { GoodDeedDto } from '@/lib/types/api';

const deedSchema = z.object({
  name: z.string().min(1).max(300),
  nameAr: z.string().min(1).max(300),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'kebab-case only'),
  category: z.string().max(100).optional(),
  reward: z.string().max(2000).optional(),
  rewardAr: z.string().max(2000).optional(),
  description: z.string().max(5000).optional(),
  descriptionAr: z.string().max(5000).optional(),
  oppositeSinId: z.string().uuid().optional().or(z.literal('')),
});

type DeedFormValues = z.infer<typeof deedSchema>;

interface DeedFormDialogProps {
  open: boolean;
  onClose: () => void;
  existing?: GoodDeedDto;
}

function DeedFormDialog({ open, onClose, existing }: DeedFormDialogProps) {
  const t = useTranslations('admin');
  const isEdit = !!existing;

  const { mutateAsync: create, isPending: isCreating } = useAdminCreateGoodDeed();
  const { mutateAsync: update, isPending: isUpdating } = useAdminUpdateGoodDeed();
  const isPending = isCreating || isUpdating;

  const { data: sinsResult } = useQuery({
    queryKey: queryKeys.sins.list({ limit: 100 }),
    queryFn: () => getSins({ limit: 100 }),
  });
  const sins = sinsResult?.data ?? [];

  const form = useForm<DeedFormValues>({
    resolver: zodResolver(deedSchema),
    defaultValues: {
      name: existing?.name ?? '',
      nameAr: existing?.nameAr ?? '',
      slug: existing?.slug ?? '',
      category: existing?.category ?? '',
      reward: existing?.reward ?? '',
      rewardAr: existing?.rewardAr ?? '',
      description: existing?.description ?? '',
      descriptionAr: existing?.descriptionAr ?? '',
      oppositeSinId: existing?.oppositeSin?.id ?? '',
    },
  });

  async function onSubmit(values: DeedFormValues) {
    const body = {
      name: values.name,
      nameAr: values.nameAr,
      slug: values.slug,
      ...(values.category ? { category: values.category } : {}),
      ...(values.reward ? { reward: values.reward } : {}),
      ...(values.rewardAr ? { rewardAr: values.rewardAr } : {}),
      ...(values.description ? { description: values.description } : {}),
      ...(values.descriptionAr ? { descriptionAr: values.descriptionAr } : {}),
      ...(values.oppositeSinId ? { oppositeSinId: values.oppositeSinId } : {}),
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
          <DialogTitle>{isEdit ? t('goodDeeds.editTitle') : t('goodDeeds.newTitle')}</DialogTitle>
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
                  <FormControl><Input dir="rtl" {...field} /></FormControl>
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
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('common.category')}</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="oppositeSinId" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>{t('goodDeeds.fieldOppositeSin')}</FormLabel>
                  <Select
                    onValueChange={(v) =>
                      field.onChange(v === '__none__' ? '' : v)
                    }
                    defaultValue={
                      field.value && field.value.length > 0
                        ? field.value
                        : '__none__'
                    }
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('goodDeeds.noOppositeSin')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">
                        {t('goodDeeds.noOppositeSin')}
                      </SelectItem>
                      {sins.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <span dir="rtl">{s.nameAr}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

export function GoodDeedCrudView() {
  const t = useTranslations('admin');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GoodDeedDto | undefined>();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.goodDeeds.list({ limit: 100 }),
    queryFn: () => getGoodDeeds({ limit: 100 }),
  });
  const deeds = data?.data ?? [];

  const { mutate: deleteDeed, isPending: isDeleting } = useAdminDeleteGoodDeed();

  const columns: ColumnDef<GoodDeedDto>[] = [
    {
      key: 'nameAr',
      header: t('common.nameAr'),
      cell: (row) => <ArabicText as="span" size="sm">{row.nameAr}</ArabicText>,
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
      key: 'quoteCount',
      header: t('common.quotes'),
      cell: (row) => <Badge variant="secondary" className="text-xs">{row.quoteCount}</Badge>,
      className: 'w-20',
    },
    {
      key: 'actions',
      header: '',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost" size="icon" className="h-8 w-8"
            aria-label={t('common.edit')}
            onClick={() => { setEditing(row); setDialogOpen(true); }}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
          </Button>
          <Button
            variant="ghost" size="icon"
            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
            aria-label={t('common.delete')}
            disabled={isDeleting}
            onClick={() => {
              if (window.confirm(t('common.confirmDelete'))) {
                deleteDeed(row.id);
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
      ),
      className: 'w-20',
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('goodDeeds.title')}</h1>
        <Button size="sm" onClick={() => { setEditing(undefined); setDialogOpen(true); }}>
          <Plus className="me-2 h-4 w-4" aria-hidden />
          {t('goodDeeds.newDeed')}
        </Button>
      </div>

      <AdminDataTable
        columns={columns}
        data={deeds}
        isLoading={isLoading}
        emptyMessage={t('goodDeeds.empty')}
        rowKey={(r) => r.id}
      />

      <DeedFormDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(undefined); }}
        existing={editing}
      />
    </div>
  );
}
