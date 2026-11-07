'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
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

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema(t)),
    defaultValues: { name: '', email: '', password: '' },
  });

  async function onSubmit(values: RegisterFormValues) {
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
      toast.error(
        err instanceof ApiError && err.code === 'EMAIL_ALREADY_REGISTERED'
          ? t('emailTaken')
          : kind === 'network' || kind === 'timeout' || kind === 'server' || kind === 'rateLimited'
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
                />
              </FormControl>
              <FormMessage />
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
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" variant="solid" tone="primary" size="md" className="w-full" disabled={isPending}>
          {isPending ? t('registering') : t('register')}
        </Button>
      </form>
    </Form>
  );
}
