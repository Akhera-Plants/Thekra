# quran module (placeholder)

This folder will hold the NestJS module responsible for everything Quran-specific: reading `Quote` rows of type
`QURAN_VERSE` together with their `Source`, exposing lookups by surah and ayah (`surahNumber`, `surahName`,
`surahNameAr`, `ayahNumber`), serving the Arabic text plus any `Translation` rows for the requested language,
and browsing or searching verses. It will read from the database only — fetching verses from external Quran
providers and caching them is the job of the `content-sync` module. Nothing is implemented in this phase.
