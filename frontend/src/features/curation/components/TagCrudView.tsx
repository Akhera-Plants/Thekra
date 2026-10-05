'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/query-keys';
import { getTags } from '@/lib/api/tags';
import { adminCreateTag, adminUpdateTag, adminDeleteTag } from '@/lib/api/admin-tags';
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
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { QuoteTagDto } from '@/lib/types/api';
import { TagCategory } from '@/lib/types/enums';

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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.values(TagCategory).map((v) => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<QuoteTagDto | undefined>();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
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

  const columns: ColumnDef<QuoteTagDto>[] = [
    {
      key: 'nameAr',
      header: t('common.nameAr'),
      cell: (row) => row.nameAr
        ? <span className="text-sm font-arabic" dir="rtl">{row.nameAr}</span>
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
      cell: (row) => <Badge variant="outline" className="text-xs">{row.category}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t('common.edit')}
            onClick={() => { setEditing(row); setDialogOpen(true); }}>
            <Pencil className="h-3.5 w-3.5" aria-hidden />
          </Button>
          <Button
            variant="ghost" size="icon"
            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
            aria-label={t('common.delete')} disabled={isDeleting}
            onClick={() => { if (window.confirm(t('common.confirmDelete'))) del(row.id); }}
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
        <h1 className="text-2xl font-semibold">{t('tags.title')}</h1>
        <Button size="sm" onClick={() => { setEditing(undefined); setDialogOpen(true); }}>
          <Plus className="me-2 h-4 w-4" aria-hidden />
          {t('tags.newTag')}
        </Button>
      </div>
      <AdminDataTable columns={columns} data={tags} isLoading={isLoading}
        emptyMessage={t('tags.empty')} rowKey={(r) => r.id} />
      <TagDialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditing(undefined); }} existing={editing} />
    </div>
  );
}
