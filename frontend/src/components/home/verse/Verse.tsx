import { FormattedNumber } from '@/components/shared/FormattedNumber';
import type { HeroVerse } from '@/lib/texts/edition';

/** The verse is the page title. It is visible on the first paint. */
export function Verse({
  verse,
  brand,
}: {
  verse: HeroVerse | null;
  brand: string;
}) {
  if (!verse) {
    return <h1 className="font-arabic-display text-4xl leading-tight text-foreground">{brand}</h1>;
  }

  return (
    <header className="flex flex-col items-end gap-3 text-end">
      <p className="font-arabic-display text-2xl leading-tight text-foreground md:text-3xl">{brand}</p>
      <h1
        dir="rtl"
        lang="ar"
        data-verse-key={verse.verseKey}
        className="max-w-prose font-quran text-[1.65rem] leading-relaxed text-foreground md:text-5xl lg:text-6xl"
      >
        {verse.text}
      </h1>
      <p className="text-sm text-muted-foreground">
        {verse.surahName} <FormattedNumber value={verse.ayah} />
      </p>
    </header>
  );
}
