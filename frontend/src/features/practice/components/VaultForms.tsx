'use client';

import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { privacyCodeProblem, VaultLockedError, type SinProgram } from '@thekra/practice-core';
import { BrandLoader } from '@/components/shared/feedback/BrandLoader';
import { Button } from '@/components/shared/kit/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { reportFailure } from '@/lib/errors';
import { updateStore } from '@/lib/practice/local-store';
import {
  VaultExistsError,
  changeVaultCode,
  createVault,
  forgetVault,
  isVaultConflict,
  mergePrograms,
  openVault,
  programsFingerprint,
  setVaultSaveState,
  setVaultSession,
  type VaultSession,
} from '@/lib/practice/vault-flow';
import { queryKeys } from '@/lib/query-keys';
import { z } from '@/lib/zod';
import { vaultApi } from '../hooks/useSinVault';

/** Lets the busy label paint before the deliberately slow key derivation runs on this thread. */
const nextFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 30));

function useNewCodeSchema() {
  const t = useTranslations('leaveSin.vault');
  return useMemo(
    () =>
      z
        .object({
          code: z.string().superRefine((code, ctx) => {
            const problem = privacyCodeProblem(code);
            if (problem) ctx.addIssue({ code: 'custom', message: t(problem === 'short' ? 'errors.short' : 'errors.weak') });
          }),
          confirm: z.string(),
          acknowledged: z.boolean().refine((v) => v, t('errors.ack')),
        })
        .refine((v) => v.code === v.confirm, { message: t('errors.mismatch'), path: ['confirm'] }),
    [t],
  );
}

type NewCodeValues = { code: string; confirm: string; acknowledged: boolean };

/** The two code fields and the «لا يمكن استرجاعه» acknowledgement, shared by «أنشئ الرمز» and «غيّر الرمز». */
function NewCodeFields({ form }: { form: ReturnType<typeof useForm<NewCodeValues>> }) {
  const t = useTranslations('leaveSin.vault');
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('code')}</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormDescription>{t('codeHint')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirm"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('codeConfirm')}</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={form.control}
        name="acknowledged"
        render={({ field }) => (
          <FormItem>
            <label className="flex cursor-pointer items-start gap-3">
              <FormControl>
                <input
                  type="checkbox"
                  className="mt-2 size-4 shrink-0 accent-primary"
                  checked={field.value}
                  onChange={(event) => field.onChange(event.target.checked)}
                />
              </FormControl>
              <span>{t('acknowledge')}</span>
            </label>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}

interface CreateCodeFormProps {
  /** What the first seal holds: the programs on this device, plus the one being started. */
  programs: readonly SinProgram[];
  userId: string;
  /** After the vault is saved and unlocked in this tab. */
  onCreated: (programs: readonly SinProgram[]) => void;
  onCancel?: () => void;
  /** Another device made the vault meanwhile: unlock it instead. */
  onExists: () => void;
}

/**
 * «رمز الخصوصية» before the first program (docs/plan/2026-11-01-sin-vault-always-on.md §1): the code locks «تخفَّف»
 * so that nobody, not even the site's team, can read it; a forgotten code cannot be recovered.
 */
export function CreateCodeForm({ programs, userId, onCreated, onCancel, onExists }: CreateCodeFormProps) {
  const t = useTranslations('leaveSin.vault');
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const schema = useNewCodeSchema();
  const form = useForm<NewCodeValues>({ resolver: zodResolver(schema), defaultValues: { code: '', confirm: '', acknowledged: false } });

  async function handleSubmit(values: NewCodeValues) {
    setBusy(true);
    setFailed(false);
    await nextFrame();
    try {
      const session = await createVault(vaultApi, programs, values.code);
      setVaultSession(session, userId, programsFingerprint(programs));
      setVaultSaveState('idle');
      form.reset();
      void queryClient.invalidateQueries({ queryKey: queryKeys.practice.vault(userId) });
      onCreated(programs);
    } catch (error) {
      if (error instanceof VaultExistsError) {
        onExists();
        return;
      }
      reportFailure('sin vault create', error);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4" noValidate>
        <ul className="flex flex-col gap-2 text-sm leading-7">
          <li className="rounded-lg border border-border bg-muted/40 px-3 py-2">{t('createWhy')}</li>
          <li className="rounded-lg border border-destructive/40 px-3 py-2">{t('warning')}</li>
        </ul>
        <NewCodeFields form={form} />
        {failed ? (
          <p className="text-destructive" role="alert">
            {t('errors.create')}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" tone="primary" disabled={busy}>
            {t('save')}
          </Button>
          {onCancel ? (
            <Button variant="outline" tone="neutral" onClick={onCancel} disabled={busy}>
              {t('cancel')}
            </Button>
          ) : null}
          {busy ? <BrandLoader label={t('working')} showLabel /> : null}
        </div>
      </form>
    </Form>
  );
}

interface UnlockFormProps {
  /** This device's copy: merged with the vault's (practice-core `mergePrograms`). */
  programs: readonly SinProgram[];
  userId: string;
  onOpened?: () => void;
  /** The account no longer has a vault (deleted elsewhere). */
  onMissing: () => void;
}

/** «افتح «تخفَّف»»: the privacy code opens the vault for this tab; a wrong code says so and lets the member try again. */
export function UnlockForm({ programs, userId, onOpened, onMissing }: UnlockFormProps) {
  const t = useTranslations('leaveSin.vault');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<'wrong' | 'load' | null>(null);
  const schema = useMemo(() => z.object({ code: z.string().min(1, t('errors.required')) }), [t]);
  const form = useForm<{ code: string }>({ resolver: zodResolver(schema), defaultValues: { code: '' } });

  async function handleSubmit(values: { code: string }) {
    setBusy(true);
    setFailed(null);
    await nextFrame();
    try {
      const opened = await openVault(vaultApi, values.code);
      if (!opened) {
        onMissing();
        return;
      }
      const merged = mergePrograms(programs, opened.programs);
      // Sealed = what the vault holds now; when this device added something, the autosave seals the merge.
      setVaultSession(opened.session, userId, programsFingerprint(opened.programs));
      setVaultSaveState('idle');
      updateStore((store) => ({ ...store, programs: merged }));
      onOpened?.();
    } catch (error) {
      if (error instanceof VaultLockedError) {
        setFailed('wrong');
        form.setFocus('code');
      } else {
        reportFailure('sin vault open', error);
        setFailed('load');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-wrap items-end gap-3" noValidate>
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem className="min-w-56 flex-1">
              <FormLabel>{t('code')}</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" tone="primary" disabled={busy}>
          {t('open')}
        </Button>
        {busy ? <BrandLoader label={t('working')} showLabel /> : null}
        {failed ? (
          <p className="basis-full text-destructive" role="alert">
            {failed === 'wrong' ? t('errors.wrongCode') : t('errors.load')}
          </p>
        ) : null}
      </form>
    </Form>
  );
}

/**
 * «نسيت الرمز؟»: the data cannot be opened without it. «ابدأ من جديد» deletes the vault and this device's programs
 * (§5), after a confirmation.
 */
export function ForgotCode({ userId }: { userId: string }) {
  const t = useTranslations('leaveSin.vault.forgot');
  const queryClient = useQueryClient();
  const [failed, setFailed] = useState(false);

  async function handleConfirm() {
    setFailed(false);
    try {
      await forgetVault(vaultApi);
      setVaultSession(null);
      setVaultSaveState('idle');
      updateStore((store) => ({ ...store, programs: [] }));
      void queryClient.invalidateQueries({ queryKey: queryKeys.practice.vault(userId) });
    } catch (error) {
      reportFailure('sin vault forget', error);
      setFailed(true);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button type="button" className="outline-button button-wrap">
            {t('button')}
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirm()}>{t('confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {failed ? (
        <p className="text-sm text-destructive" role="alert">
          {t('failed')}
        </p>
      ) : null}
    </div>
  );
}

interface ChangeCodeFormProps {
  session: VaultSession;
  programs: readonly SinProgram[];
  userId: string;
  onDone: () => void;
}

/** «غيّر رمز الخصوصية» (§5): a new code seals the programs again; the old code no longer opens them. */
export function ChangeCodeForm({ session, programs, userId, onDone }: ChangeCodeFormProps) {
  const t = useTranslations('leaveSin.vault');
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<'conflict' | 'save' | null>(null);
  const schema = useNewCodeSchema();
  const form = useForm<NewCodeValues>({ resolver: zodResolver(schema), defaultValues: { code: '', confirm: '', acknowledged: false } });

  async function handleSubmit(values: NewCodeValues) {
    setBusy(true);
    setFailed(null);
    await nextFrame();
    try {
      const next = await changeVaultCode(vaultApi, session, programs, values.code);
      setVaultSession(next, userId, programsFingerprint(programs));
      form.reset();
      void queryClient.invalidateQueries({ queryKey: queryKeys.practice.vault(userId) });
      onDone();
    } catch (error) {
      if (!isVaultConflict(error)) reportFailure('sin vault change code', error);
      setFailed(isVaultConflict(error) ? 'conflict' : 'save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4" noValidate>
        <p className="rounded-lg border border-destructive/40 px-3 py-2 text-sm leading-7">{t('warning')}</p>
        <NewCodeFields form={form} />
        {failed ? (
          <p className="text-destructive" role="alert">
            {failed === 'conflict' ? t('errors.changeConflict') : t('errors.save')}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" tone="primary" disabled={busy}>
            {t('changeSave')}
          </Button>
          <Button variant="outline" tone="neutral" onClick={onDone} disabled={busy}>
            {t('cancel')}
          </Button>
          {busy ? <BrandLoader label={t('working')} showLabel /> : null}
        </div>
      </form>
    </Form>
  );
}
