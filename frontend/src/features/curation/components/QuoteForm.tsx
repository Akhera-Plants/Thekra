'use client';

/**
 * QuoteForm — create or edit a LOCAL quote.
 * Do NOT invent religious content — all fields are empty by default.
 */

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { getSources } from '@/lib/api/sources';
import { useAdminCreateQuote, useAdminUpdateQuote } from '../hooks/useAdminQuotes';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import type { QuoteDto } from '@/lib/types/api';
import { HadithGrade, QuoteType } from '@/lib/types/enums';

// ── Schema ────────────────────────────────────────────────────────────────────

const quoteSchema = z.object({
  type: z.nativeEnum(QuoteType),
  textAr: z.string().min(3).max(10000),
  sourceId: z.string().uuid(),
  // QURAN — stored as strings to keep form value type simple; coerced on submit
  surahNumber: z.string().optional(),
  ayahNumber: z.string().optional(),
  surahName: z.string().max(100).optional(),
  surahNameAr: z.string().max(100).optional(),
  // HADITH
  narrator: z.string().max(200).optional(),
  narratorAr: z.string().max(200).optional(),
  grade: z.nativeEnum(HadithGrade).optional(),
  hadithReference: z.string().max(200).optional(),
  // BOOK / SCHOLAR
  bookTitle: z.string().max(300).optional(),
  author: z.string().max(300).optional(),
  pageOrChapter: z.string().max(100).optional(),
});

type QuoteFormValues = z.infer<typeof quoteSchema>;

interface QuoteFormProps {
  existing?: QuoteDto;
}

export function QuoteForm({ existing }: QuoteFormProps) {
  const t = useTranslations('admin');
  const router = useRouter();
  const isEdit = !!existing;

  const { data: sourcesResult } = useQuery({
    queryKey: queryKeys.sources.all,
    queryFn: () => getSources({ limit: 100 }),
  });
  const sources = sourcesResult?.data ?? [];

  const { mutateAsync: createQuote, isPending: isCreating } = useAdminCreateQuote();
  const { mutateAsync: updateQuote, isPending: isUpdating } = useAdminUpdateQuote(existing?.id ?? '');
  const isPending = isCreating || isUpdating;

  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      type: existing?.type ?? QuoteType.HADITH,
      textAr: existing?.textAr ?? '',
      sourceId: existing?.source?.id ?? '',
      surahNumber: existing?.quran?.surahNumber != null ? String(existing.quran.surahNumber) : '',
      ayahNumber: existing?.quran?.ayahNumber != null ? String(existing.quran.ayahNumber) : '',
      surahName: existing?.quran?.surahName ?? '',
      surahNameAr: existing?.quran?.surahNameAr ?? '',
      narrator: existing?.hadith?.narrator ?? '',
      narratorAr: existing?.hadith?.narratorAr ?? '',
      grade: existing?.hadith?.grade ?? undefined,
      hadithReference: existing?.hadith?.reference ?? '',
      bookTitle: existing?.book?.bookTitle ?? '',
      author: existing?.book?.author ?? '',
      pageOrChapter: existing?.book?.pageOrChapter ?? '',
    },
  });

  const watchType = useWatch({ control: form.control, name: 'type' });

  async function onSubmit(values: QuoteFormValues) {
    const parsedSurahNumber = values.surahNumber ? parseInt(values.surahNumber, 10) : undefined;
    const parsedAyahNumber = values.ayahNumber ? parseInt(values.ayahNumber, 10) : undefined;

    const body = {
      type: values.type,
      textAr: values.textAr,
      sourceId: values.sourceId,
      ...(parsedSurahNumber ? { surahNumber: parsedSurahNumber } : {}),
      ...(parsedAyahNumber ? { ayahNumber: parsedAyahNumber } : {}),
      ...(values.surahName ? { surahName: values.surahName } : {}),
      ...(values.surahNameAr ? { surahNameAr: values.surahNameAr } : {}),
      ...(values.narrator ? { narrator: values.narrator } : {}),
      ...(values.narratorAr ? { narratorAr: values.narratorAr } : {}),
      ...(values.grade ? { grade: values.grade } : {}),
      ...(values.hadithReference ? { hadithReference: values.hadithReference } : {}),
      ...(values.bookTitle ? { bookTitle: values.bookTitle } : {}),
      ...(values.author ? { author: values.author } : {}),
      ...(values.pageOrChapter ? { pageOrChapter: values.pageOrChapter } : {}),
    };

    if (isEdit && existing) {
      await updateQuote(body);
      router.push(`/admin/quotes/${existing.id}`);
    } else {
      const result = await createQuote(body);
      router.push(`/admin/quotes/${result.data.id}`);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
        <div className="grid gap-4 md:grid-cols-2">
          {/* Type */}
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('quotes.fieldType')}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.values(QuoteType).map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Source */}
          <FormField
            control={form.control}
            name="sourceId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('quotes.fieldSource')}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('quotes.selectSource')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {sources.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Arabic text */}
        <FormField
          control={form.control}
          name="textAr"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('quotes.fieldTextAr')}</FormLabel>
              <FormControl>
                <textarea
                  dir="rtl"
                  rows={5}
                  placeholder={t('quotes.textArPlaceholder')}
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 font-arabic text-lg leading-loose ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Quran fields */}
        {watchType === QuoteType.QURAN_VERSE && (
          <>
            <Separator />
            <p className="text-sm font-medium text-muted-foreground">{t('quotes.sectionQuran')}</p>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField control={form.control} name="surahNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('quotes.fieldSurahNumber')}</FormLabel>
                  <FormControl><Input type="number" min={1} max={114} placeholder="1–114" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="ayahNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('quotes.fieldAyahNumber')}</FormLabel>
                  <FormControl><Input type="number" min={1} max={286} placeholder="1–286" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="surahName" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('quotes.fieldSurahName')}</FormLabel>
                  <FormControl><Input placeholder="Al-Baqarah" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="surahNameAr" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('quotes.fieldSurahNameAr')}</FormLabel>
                  <FormControl><Input dir="rtl" placeholder="البقرة" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </>
        )}

        {/* Hadith fields */}
        {watchType === QuoteType.HADITH && (
          <>
            <Separator />
            <p className="text-sm font-medium text-muted-foreground">{t('quotes.sectionHadith')}</p>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField control={form.control} name="narrator" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('quotes.fieldNarrator')}</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="narratorAr" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('quotes.fieldNarratorAr')}</FormLabel>
                  <FormControl><Input dir="rtl" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="grade" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('quotes.fieldGrade')}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder={t('quotes.selectGrade')} /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.values(HadithGrade).map((g) => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="hadithReference" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('quotes.fieldReference')}</FormLabel>
                  <FormControl><Input placeholder="Bukhari 1234" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </>
        )}

        {/* Book / Scholar fields */}
        {(watchType === QuoteType.SCHOLAR_QUOTE || watchType === QuoteType.BOOK_EXCERPT) && (
          <>
            <Separator />
            <p className="text-sm font-medium text-muted-foreground">{t('quotes.sectionBook')}</p>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField control={form.control} name="bookTitle" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('quotes.fieldBookTitle')}</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="author" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('quotes.fieldAuthor')}</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="pageOrChapter" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('quotes.fieldPageOrChapter')}</FormLabel>
                  <FormControl><Input placeholder="p. 42" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={isPending}>
            {isPending
              ? t('common.saving')
              : isEdit
                ? t('common.saveChanges')
                : t('quotes.createQuote')}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            {t('common.cancel')}
          </Button>
        </div>
      </form>
    </Form>
  );
}
