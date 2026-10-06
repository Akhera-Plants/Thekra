'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/query-keys';
import { getSources } from '@/lib/api/sources';
import { adminCreateSource, adminUpdateSource, adminDeleteSource } from '@/lib/api/admin-sources';
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
import type { QuoteSourceDto } from '@/lib/types/api';
import { SourceType } from '@/lib/types/enums';

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
                  <FormControl><Input dir="rtl" {...field} /></FormControl>
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
                        <SelectItem key={v} value={v}>{v}</SelectItem>
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<QuoteSourceDto | undefined>();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.sources.list({}),
    queryFn: () => getSources({ limit: 100 }),
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

  const columns: ColumnDef<QuoteSourceDto>[] = [
    {
      key: 'name',
      header: t('common.nameEn'),
      cell: (row) => <span className="text-sm font-medium">{row.name}</span>,
    },
    {
      key: 'nameAr',
      header: t('common.nameAr'),
      cell: (row) => row.nameAr
        ? <span className="text-sm font-arabic" dir="rtl">{row.nameAr}</span>
        : <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'type',
      header: t('common.type'),
      cell: (row) => <Badge variant="outline" className="text-xs">{row.type}</Badge>,
    },
    {
      key: 'author',
      header: t('sources.fieldAuthor'),
      cell: (row) => <span className="text-sm text-muted-foreground">{row.author ?? '—'}</span>,
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
        <h1 className="text-2xl font-semibold">{t('sources.title')}</h1>
        <Button size="sm" onClick={() => { setEditing(undefined); setDialogOpen(true); }}>
          <Plus className="me-2 h-4 w-4" aria-hidden />
          {t('sources.newSource')}
        </Button>
      </div>
      <AdminDataTable columns={columns} data={sources} isLoading={isLoading}
        emptyMessage={t('sources.empty')} rowKey={(r) => r.id} />
      <SourceDialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditing(undefined); }} existing={editing} />
    </div>
  );
}
