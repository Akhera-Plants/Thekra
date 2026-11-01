import { NextResponse, type NextRequest } from 'next/server';
import { getPathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

/** «السجل» became «عاداتي» (owner, 2026-11-01): one page for the habits and their statistics. Old links still land. */
export async function GET(request: NextRequest, ctx: RouteContext<'/[locale]/practice/record'>) {
  const { locale } = await ctx.params;
  const known = routing.locales.find((l) => l === locale) ?? routing.defaultLocale;
  return NextResponse.redirect(new URL(getPathname({ href: '/practice/habits', locale: known }), request.url), 308);
}
