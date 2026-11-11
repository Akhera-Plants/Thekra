'use client';

import { setZodLocale } from '@/lib/zod';

/** Puts zod's form messages in the page's language before any form on the page validates. Renders nothing. */
export function ZodLocale({ locale }: { locale: 'ar' | 'en' }) {
  setZodLocale(locale);
  return null;
}
