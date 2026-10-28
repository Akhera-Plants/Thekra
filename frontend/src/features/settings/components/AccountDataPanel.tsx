'use client';

import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Download, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/shared/kit/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useSession } from '@/features/auth/hooks/useSession';
import { deleteAccount, getAccountExport } from '@/lib/api/practice-me';
import { failureKey, reportFailure } from '@/lib/errors';
import { downloadTextFile } from '@/lib/practice/download';
import { forgetAccount } from '@/lib/practice/sync-controller';
import { setVaultSession } from '@/lib/practice/vault-flow';
import { ApiError } from '@/lib/types/api';
import { z } from '@/lib/zod';

/** «تصدير بياناتي» and «حذف الحساب». The copy on this device is kept in both cases. */
export function AccountDataPanel() {
  const t = useTranslations('settings.data');
  const tFeedback = useTranslations('feedback');
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const data = await getAccountExport();
      downloadTextFile('thekra-export.json', JSON.stringify(data, null, 2), 'application/json;charset=utf-8');
    } catch (error) {
      reportFailure('account export', error);
      toast.error(tFeedback(`error.${failureKey(error)}`));
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="flex flex-col gap-4" aria-labelledby="account-data-title">
      <h2 id="account-data-title" className="text-sm font-medium">
        {t('title')}
      </h2>
      <div className="flex flex-col items-start gap-2">
        <Button variant="outline" tone="primary" size="sm" onClick={() => void handleExport()} disabled={exporting}>
          <Download aria-hidden />
          {t('export')}
        </Button>
        <p className="text-sm text-muted-foreground">{t('exportNote')}</p>
      </div>
      <DeleteAccount />
    </section>
  );
}

function DeleteAccount() {
  const t = useTranslations('settings.data');
  const tFeedback = useTranslations('feedback');
  const router = useRouter();
  const { clearSession } = useSession();
  const [open, setOpen] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const schema = useMemo(() => z.object({ password: z.string().min(1, t('passwordRequired')) }), [t]);
  const form = useForm<{ password: string }>({ resolver: zodResolver(schema), defaultValues: { password: '' } });

  async function handleSubmit(values: { password: string }) {
    setFailure(null);
    try {
      await deleteAccount(values.password);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setFailure(t('wrongPassword'));
        form.setFocus('password');
        return;
      }
      reportFailure('account delete', error);
      setFailure(tFeedback(`error.${failureKey(error)}`));
      return;
    }
    // The account is gone; this device keeps its copy, linked to no account.
    forgetAccount();
    setVaultSession(null);
    await clearSession();
    setOpen(false);
    toast.success(t('deleted'));
    router.push('/');
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="outline" tone="destructive" size="sm">
            <Trash2 aria-hidden />
            {t('delete')}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4" noValidate>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('deleteTitle')}</AlertDialogTitle>
                <AlertDialogDescription>{t('deleteBody')}</AlertDialogDescription>
              </AlertDialogHeader>
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('password')}</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="current-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {failure ? (
                <p className="text-sm text-destructive" role="alert">
                  {failure}
                </p>
              ) : null}
              <AlertDialogFooter>
                <AlertDialogCancel type="button">{t('cancel')}</AlertDialogCancel>
                <Button type="submit" variant="solid" tone="destructive" size="sm" disabled={form.formState.isSubmitting}>
                  {t('deleteConfirm')}
                </Button>
              </AlertDialogFooter>
            </form>
          </Form>
        </AlertDialogContent>
      </AlertDialog>
      <p className="text-sm text-muted-foreground">{t('deleteNote')}</p>
    </div>
  );
}
