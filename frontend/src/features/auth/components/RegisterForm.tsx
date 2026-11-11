'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useForm } from 'react-hook-form';
import { z } from '@/lib/zod';
import { toast } from 'sonner';

import { Button } from '@/components/shared/kit/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { failureKey } from '@/lib/errors';
import { ApiError } from '@/lib/types/api';
import { useRegister } from '../hooks/useRegister';
import { nextPathFromLocation } from '../next-path';

/** The name is required (owner, 2026-11-01). Every message comes from the page's language. */
function registerSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().trim().min(1, { error: t('nameRequired') }).max(80, { error: t('nameTooLong') }),
    email: z.email({ error: t('emailInvalid') }),
    password: z.string().min(10, { error: t('passwordMin') }).max(128, { error: t('passwordMax') }),
  });
}

type RegisterFormValues = z.infer<ReturnType<typeof registerSchema>>;

export function RegisterForm() {
  const t = useTranslations('auth');
  const tFeedback = useTranslations('feedback');
  const router = useRouter();
  const { mutateAsync: register, isPending } = useRegister();
  const [takenEmail, setTakenEmail] = useState<{ address: string; next: string } | null>(null);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema(t)),
    defaultValues: { name: '', email: '', password: '' },
  });

  async function onSubmit(values: RegisterFormValues) {
    setTakenEmail(null);
    try {
      await register({
        email: values.email,
        password: values.password,
        name: values.name,
      });
      toast.success(t('registerSuccess'));
      // A new member lands on «عاداتي» and its three-step start (F-26 a), unless a page sent them here.
      router.push(nextPathFromLocation('/practice'));
    } catch (err) {
      // Never the raw API text: a taken email says so; connection-type failures get the shared localised message.
      const kind = failureKey(err);
      // A taken email is said under the field with «سجّل الدخول» and the typed email carried over, not in a toast.
      if (err instanceof ApiError && err.code === 'EMAIL_ALREADY_REGISTERED') {
        setTakenEmail({ address: values.email, next: nextPathFromLocation('') });
        return;
      }
      toast.error(
        kind === 'network' || kind === 'timeout' || kind === 'server' || kind === 'rateLimited'
            ? tFeedback(`error.${kind}`)
            : t('registerError'),
      );
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
        noValidate
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('name')}</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  autoComplete="name"
                  required
                  placeholder={t('namePlaceholder')}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('email')}</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder={t('emailPlaceholder')}
                  {...field}
                  onChange={(event) => {
                    setTakenEmail(null);
                    field.onChange(event);
                  }}
                />
              </FormControl>
              <FormMessage />
              {takenEmail ? (
                <p role="alert" className="flex flex-wrap items-center gap-x-2 text-sm text-destructive">
                  {t('emailTaken')}
                  <Link
                    href={{ pathname: '/login', query: { email: takenEmail.address, ...(takenEmail.next ? { next: takenEmail.next } : {}) } }}
                    className="font-medium underline underline-offset-2"
                  >
                    {t('signInNow')}
                  </Link>
                </p>
              ) : null}
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('password')}</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder={t('passwordPlaceholder')}
                  aria-describedby="password-rule"
                  {...field}
                />
              </FormControl>
              {/* The rule before submit, not only after a failure (owner round 8, item 2). */}
              <p id="password-rule" className="text-sm text-muted-foreground">{t('passwordHint')}</p>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" variant="solid" tone="primary" size="md" className="w-full" disabled={isPending}>
          {isPending ? t('registering') : t('register')}
        </Button>
        <Link href="/about#privacy" className="self-center text-sm text-muted-foreground underline underline-offset-2">
          {t('privacyPolicy')}
        </Link>
      </form>
    </Form>
  );
}
