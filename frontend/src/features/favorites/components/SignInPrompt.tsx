/**
 * SignInPrompt — shown on /favorites and when a guest tries to save a quote.
 * Never a hard redirect; the guest flow is always accessible.
 */
'use client';

import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

interface SignInPromptProps {
  /** Whether shown inside a card/overlay (compact) or as a full-page block */
  variant?: 'inline' | 'page';
  className?: string;
}

export function SignInPrompt({ variant = 'page', className }: SignInPromptProps) {
  const t = useTranslations('auth');

  if (variant === 'inline') {
    return (
      <div
        className={`flex flex-col items-center gap-3 rounded-lg border border-border bg-muted/50 p-4 text-center ${className ?? ''}`}
        role="status"
      >
        <Heart className="size-5 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">{t('signInToFavorite')}</p>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="default">
            <Link href="/login">{t('signIn')}</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/register">{t('register')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center gap-6 py-16 text-center ${className ?? ''}`}
      role="status"
    >
      <div className="flex size-16 items-center justify-center rounded-full bg-muted">
        <Heart className="size-8 text-muted-foreground" aria-hidden />
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">{t('favoritesSignInTitle')}</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t('favoritesSignInDescription')}
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild size="default">
          <Link href="/login">{t('signIn')}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/register">{t('register')}</Link>
        </Button>
      </div>
    </div>
  );
}
