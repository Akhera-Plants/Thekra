'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from '@/lib/zod';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/query-keys';
import { getTags } from '@/lib/api/tags';
import { adminCreateTag, adminUpdateTag, adminDeleteTag } from '@/lib/api/admin-tags';
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
import type { QuoteTagDto } from '@/lib/types/api';
import { TagCategory } from '@/lib/types/enums';
import { adminLabel } from '@/lib/format/admin-labels';
import { PageHeader } from './kit/PageHeader';
import { RowActions } from './kit/RowActions';
import { formatCount } from './kit/format';


const tagSchema = z.object({
  name: z.string().min(1).max(200),
  nameAr: z.string().max(200).optional(),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'kebab-case only'),
  category: z.nativeEnum(TagCategory),
});

type TagFormValues = z.infer<typeof tagSchema>;

interface TagDialogProps {
  open: boolean;
  onClose: () => void;
  existing?: QuoteTagDto;
}

function TagDialog({ open, onClose, existing }: TagDialogProps) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const isEdit = !!existing;
  const qc = useQueryClient();

  const { mutate: save, isPending } = useMutation({
    mutationFn: async (values: TagFormValues) => {
      if (isEdit && existing) return adminUpdateTag(existing.id, values);
      return adminCreateTag(values);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.tags.all });
      void qc.invalidateQueries({ queryKey: queryKeys.adminTags.all });
      toast.success(t('tags.saveSuccess'));
      onClose();
    },
    onError: () => toast.error(t('tags.saveError')),
  });

  const form = useForm<TagFormValues>({
    resolver: zodResolver(tagSchema),
    defaultValues: {
      name: existing?.name ?? '',
      nameAr: existing?.nameAr ?? '',
      slug: existing?.slug ?? '',
      category: existing?.category ?? TagCategory.THEME,
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('tags.editTitle') : t('tags.newTitle')}</DialogTitle>
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.values(TagCategory).map((v) => (
                        <SelectItem key={v} value={v}>{adminLabel('tagCategory', v, locale)}</SelectItem>
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

export function TagCrudView() {
  const t = useTranslations('admin');
  const locale = useLocale();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<QuoteTagDto | undefined>();
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.tags.list({}),
    queryFn: () => getTags({}),
  });
  const tags = data?.data ?? [];

  const { mutate: del, isPending: isDeleting } = useMutation({
    mutationFn: adminDeleteTag,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.tags.all });
      toast.success(t('tags.deleteSuccess'));
    },
    onError: () => toast.error(t('tags.deleteError')),
  });

  const allColumns: ColumnDef<QuoteTagDto>[] = [
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
      key: 'slug',
      header: t('common.slug'),
      cell: (row) => <code className="text-xs text-muted-foreground">{row.slug}</code>,
    },
    {
      key: 'category',
      header: t('common.category'),
      cell: (row) => <span className="text-muted-foreground">{adminLabel('tagCategory', row.category, locale)}</span>,
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
            confirmBody: row.nameAr ?? row.name,
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
        title={t('tags.title')}
        meta={isLoading ? undefined : formatCount(tags.length)}
        actions={
          <Button size="sm" className="desk-press" onClick={() => { setEditing(undefined); setDialogOpen(true); }}>
            <Plus data-icon="inline-start" aria-hidden />
            {t('tags.newTag')}
          </Button>
        }
      />
      <AdminDataTable columns={columns} data={tags} isLoading={isLoading} isError={isError}
        onRetry={() => void refetch()} emptyMessage={t('tags.empty')} rowKey={(r) => r.id} />
      <TagDialog key={editing?.id ?? 'new'} open={dialogOpen} onClose={() => { setDialogOpen(false); setEditing(undefined); }} existing={editing} />
    </div>
  );
}
