'use client';

import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { KeyRound, LockKeyhole, LockKeyholeOpen, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { activePrograms, privacyCodeProblem, VaultLockedError, type SinProgram } from '@thekra/practice-core';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/shared/kit/button';
import { BrandLoader } from '@/components/shared/feedback/BrandLoader';
import { QueryErrorState } from '@/components/shared/feedback/QueryErrorState';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { reportFailure } from '@/lib/errors';
import { updateStore } from '@/lib/practice/local-store';
import {
  VaultExistsError,
  createVault,
  lastSealedFingerprint,
  mergePrograms,
  openVault,
  programsFingerprint,
  saveVault,
  setVaultSession,
} from '@/lib/practice/vault-flow';
import { queryKeys } from '@/lib/query-keys';
import { z } from '@/lib/zod';
import { useSignInHrefs } from '../hooks/useSignInHref';
import { useSinVault, vaultApi } from '../hooks/useSinVault';

const AUTOSAVE_DELAY_MS = 800;

/** Lets the busy label paint before the deliberately slow key derivation runs on this thread. */
const nextFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 30));

interface VaultPanelProps {
  programs: readonly SinProgram[];
}

/**
 * «احفظ البرنامج مشفّرًا في حسابك» / «افتح البرنامج». Device-only by default; with an account the programs can be
 * sealed under a privacy code and re-sealed after every change while unlocked in this tab.
 */
export function VaultPanel({ programs }: VaultPanelProps) {
  const t = useTranslations('leaveSin.vault');
  const hrefs = useSignInHrefs();
  const queryClient = useQueryClient();
  const { accounts, userId, sessionLoading, vault, session } = useSinVault();
  const [offering, setOffering] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error' | 'reopen'>('idle');
  const fingerprint = programsFingerprint(programs);

  async function saveNow() {
    const current = session;
    if (!current || !userId) return;
    setSaveState('saving');
    try {
      const result = await saveVault(vaultApi, current, programs);
      const sealed = programsFingerprint(result.programs);
      if (sealed !== programsFingerprint(programs)) updateStore((store) => ({ ...store, programs: result.programs }));
      setVaultSession(result.session, userId, sealed);
      setSaveState('idle');
      void queryClient.invalidateQueries({ queryKey: queryKeys.practice.vault(userId) });
    } catch (error) {
      if (error instanceof VaultLockedError) {
        setVaultSession(null);
        setSaveState('reopen');
        void queryClient.invalidateQueries({ queryKey: queryKeys.practice.vault(userId) });
        return;
      }
      reportFailure('sin vault save', error);
      setSaveState('error');
    }
  }

  // Re-seal after each check-in or edit while the vault is unlocked in this tab.
  useEffect(() => {
    if (!session || !userId || fingerprint === lastSealedFingerprint()) return;
    const timer = setTimeout(() => void saveNow(), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
    // saveNow reads the latest props; the fingerprint and session are what decide a new seal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint, session, userId]);

  if (!accounts || sessionLoading) return null;

  if (!userId) {
    return (
      <Box icon={<LockKeyhole />} title={t('title')}>
        <p>{t('guest')}</p>
        <p className="flex flex-wrap gap-x-4">
          <Link href={hrefs.login} className="text-link">
            {t('signIn')}
          </Link>
          <Link href={hrefs.register} className="text-link">
            {t('register')}
          </Link>
        </p>
      </Box>
    );
  }

  if (vault.isPending) return <BrandLoader label={t('checking')} showLabel />;
  if (vault.isError) return <QueryErrorState error={vault.error} onRetry={() => void vault.refetch()} className="py-4" />;

  if (session) {
    return (
      <Box icon={<LockKeyholeOpen />} title={t('title')}>
        <p>{t('saved')}</p>
        {saveState === 'saving' ? <BrandLoader label={t('saving')} showLabel /> : null}
        {saveState === 'error' ? (
          <div className="flex flex-col items-start gap-2" role="alert">
            <p className="text-destructive">{t('errors.save')}</p>
            <Button variant="outline" tone="primary" size="sm" onClick={() => void saveNow()}>
              <RefreshCw aria-hidden />
              {t('retry')}
            </Button>
          </div>
        ) : null}
        <Button variant="ghost" tone="neutral" size="sm" className="self-start" onClick={() => setVaultSession(null)}>
          {t('lock')}
        </Button>
      </Box>
    );
  }

  if (vault.data) {
    return (
      <Box icon={<LockKeyhole />} title={t('lockedTitle')}>
        {saveState === 'reopen' ? <p className="text-destructive">{t('errors.reopen')}</p> : null}
        <p>{t('lockedLead')}</p>
        <OpenForm
          programs={programs}
          onOpened={() => setSaveState('idle')}
          onMissing={() => void vault.refetch()}
          userId={userId}
        />
      </Box>
    );
  }

  if (activePrograms(programs).length === 0) return null;

  return (
    <Box icon={<KeyRound />} title={t('title')}>
      {offering ? (
        <CreateForm
          programs={programs}
          userId={userId}
          onCancel={() => setOffering(false)}
          onExists={() => {
            setOffering(false);
            void vault.refetch();
          }}
        />
      ) : (
        <>
          <p>{t('offerLead')}</p>
          <button type="button" className="outline-button button-wrap self-start" onClick={() => setOffering(true)}>
            {t('offer')}
          </button>
        </>
      )}
    </Box>
  );
}

function Box({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 leading-8" aria-label={title}>
      <h2 className="flex items-center gap-2 text-lg font-medium">
        <span className="text-primary [&_svg]:size-5" aria-hidden>
          {icon}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function CreateForm({
  programs,
  userId,
  onCancel,
  onExists,
}: {
  programs: readonly SinProgram[];
  userId: string;
  onCancel: () => void;
  onExists: () => void;
}) {
  const t = useTranslations('leaveSin.vault');
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<'save' | null>(null);
  const schema = useMemo(
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
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { code: '', confirm: '', acknowledged: false } });

  async function handleSubmit(values: Values) {
    setBusy(true);
    setFailed(null);
    await nextFrame();
    try {
      const session = await createVault(vaultApi, programs, values.code);
      setVaultSession(session, userId, programsFingerprint(programs));
      form.reset();
      void queryClient.invalidateQueries({ queryKey: queryKeys.practice.vault(userId) });
    } catch (error) {
      if (error instanceof VaultExistsError) {
        onExists();
        return;
      }
      reportFailure('sin vault create', error);
      setFailed('save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4" noValidate>
        <p>{t('offerLead')}</p>
        <p className="next-step !mt-0" role="note">
          <strong>{t('warningTitle')}</strong>
          {t('warning')}
        </p>
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
        {failed === 'save' ? (
          <p className="text-destructive" role="alert">
            {t('errors.create')}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="solid-button button-wrap" disabled={busy}>
            {t('save')}
          </button>
          <button type="button" className="outline-button button-wrap" onClick={onCancel} disabled={busy}>
            {t('cancel')}
          </button>
          {busy ? <BrandLoader label={t('working')} showLabel /> : null}
        </div>
      </form>
    </Form>
  );
}

function OpenForm({
  programs,
  userId,
  onOpened,
  onMissing,
}: {
  programs: readonly SinProgram[];
  userId: string;
  onOpened: () => void;
  onMissing: () => void;
}) {
  const t = useTranslations('leaveSin.vault');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<'wrong' | 'load' | null>(null);
  const schema = useMemo(() => z.object({ code: z.string().min(1, t('errors.short')) }), [t]);
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
      updateStore((store) => ({ ...store, programs: merged }));
      onOpened();
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
        <button type="submit" className="solid-button button-wrap" disabled={busy}>
          {t('open')}
        </button>
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
