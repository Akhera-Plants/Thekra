'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useForm } from 'react-hook-form';
import { z } from '@/lib/zod';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
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
import { useLogin } from '../hooks/useLogin';
import { nextPathFromLocation } from '../next-path';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginFormProps {
  /** Where to go after a successful sign-in. Defaults to home. */
  redirectTo?: string;
}

export function LoginForm({ redirectTo = '/' }: LoginFormProps) {
  const t = useTranslations('auth');
  const tFeedback = useTranslations('feedback');
  const router = useRouter();
  const { mutateAsync: login, isPending } = useLogin();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: LoginFormValues) {
    try {
      await login(values);
      toast.success(t('loginSuccess'));
      router.push(nextPathFromLocation(redirectTo));
      router.refresh();
    } catch (err) {
      // Never the raw API text: connection-type failures get the shared localised message.
      const kind = failureKey(err);
      toast.error(
        kind === 'network' || kind === 'timeout' || kind === 'server' || kind === 'rateLimited'
          ? tFeedback(`error.${kind}`)
          : t('loginError'),
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
                  autoComplete="current-password"
                  placeholder={t('passwordPlaceholder')}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? t('signingIn') : t('signIn')}
        </Button>
      </form>
    </Form>
  );
}
