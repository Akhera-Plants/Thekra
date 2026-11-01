import { NextResponse, type NextRequest } from 'next/server';
import { getPathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

/** «تذكيراتي» is a tab of «المحفوظات» now (owner, 2026-11-01). Old links still land on it. */
export async function GET(request: NextRequest, ctx: RouteContext<'/[locale]/practice/my-reminders'>) {
  const { locale } = await ctx.params;
  const known = routing.locales.find((l) => l === locale) ?? routing.defaultLocale;
  const href = { pathname: '/favorites', query: { tab: 'reminders' } } as const;
  return NextResponse.redirect(new URL(getPathname({ href, locale: known }), request.url), 308);
}
