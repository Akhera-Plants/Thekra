# English face: Source Serif 4 (replaces Amiri for English)

**Decision (owner override):** the English UI and English reading text use **Source Serif 4**
(Adobe, SIL OFL 1.1). Amiri stays for Arabic only: the Quran class (`.quran`), source-book
wordmarks and the tagline in Arabic. Arabic rendering is unchanged (Plex for the public UI,
Thmanyah serif for Arabic reading, Amiri Quran / Amiri for the Quran).

## Why change

Amiri is a Naskh face whose Latin is a secondary design: small x-height, narrow, light colour.
At 17–18px it reads smaller and greyer than the Arabic beside it, so it was pushed to large
sizes; it has no small caps or old-style figures, and its Latin is not tuned for long English
reading or dense UI (chips, breadcrumbs, source names).

## What the site needs from an English face

- Transliteration on every page: `ʿ ʾ ā ī ū ḥ ṣ ḍ ṭ ẓ` and capitals, plus `ḏ ṯ ġ ḫ`.
- Real small caps (`smcp`, `c2sc`) for source names and abbreviations, not synthesized ones.
- A text colour and x-height that sit beside IBM Plex Sans Arabic and the Arabic reading face.
- Free, self-hostable, licence-clear.

## Candidates, checked by rendering (not by assumption)

Specimen: [candidates-specimen.png](<english-font/candidates-specimen.png>) — each candidate sets
the same scholarly paragraph, a small-caps line and the UI labels, beside Thmanyah (reading) and
Plex (UI) Arabic at site sizes. Coverage of the Google-served files:
[google-subset-coverage.json](<english-font/google-subset-coverage.json>) (font files downloaded
and their `cmap`/`GSUB` read with fontTools).

| Candidate | Transliteration (Google subset) | Real small caps (Google) | Upstream file | Verdict |
|---|---|---|---|---|
| **Source Serif 4** | all present | no (Google strips `smcp`) | 4.005 variable woff2: all marks, `smcp` + `c2sc` + `onum`, opsz 8–60 | **chosen** |
| Literata | all present | no | variable TTF has `smcp`, but `ʿ ʾ` carry wide side-bearings («Qurʾ ān», «ʿ anhu») | close second; marks look detached |
| Charis SIL | `ʿ ʾ` missing | no | upstream has both, but only 400/700, large files, Reserved Font Name blocks subsetting | sturdy, too heavy beside Plex |
| Newsreader | dot-below letters and `ʿ ʾ` missing | no | — | rejected: falls back for ḥ ṣ ḍ ṭ ẓ |
| Lora | dot-below letters missing | no | — | rejected: falls back for ḥ ṣ ḍ ṭ ẓ |
| Amiri (before) | all present | no `smcp` | — | small, light Latin; replaced |

Google's CSS API serves every one of these without `smcp`/`c2sc` (only `ccmp`, `liga`, figures),
and serves Charis SIL without `ʿ ʾ`. `next/font/google` would therefore lose the small caps, so
the face is self-hosted from Adobe's release instead (`next/font/local`).

## In the app (verified)

[glyph-test-in-app.png](<english-font/glyph-test-in-app.png>) is rendered inside the running
`/en` page. Chrome's `CSS.getPlatformFontsForNode` reports which font file drew each run:

| Run | Drawn by |
|---|---|
| `ʿ ʾ ā ī ū ḥ ṣ ḍ ṭ ẓ Ā Ī Ū Ḥ Ṣ Ḍ Ṭ Ẓ ḏ ṯ ġ ḫ …` | Source Serif 4 Variable (Roman), web font, no fallback |
| `font-variant-caps: small-caps` / `all-small-caps` | Source Serif 4 Variable **SmText** instance (real small-cap glyphs) |
| italic `ghība, ṣadaqa, ʿilm` | Source Serif 4 Variable (Italic), web font |
| 18px body paragraph | Source Serif 4 Variable (Roman), opsz chosen automatically |

## Files and settings

- Fonts: `frontend/src/fonts/source-serif/SourceSerif4Variable-{Roman,Italic}.ttf.woff2`
  (Adobe `source-serif` release 4.005, unmodified; SHA-256 `940a76eda1…e1be` roman,
  `9d28b5749a…fb44` italic).
- Licence: `frontend/public/licenses/SOURCE-SERIF-4-OFL.txt` (Reserved Font Name «Source»; the
  files are shipped unmodified, so the name is kept).
- `frontend/src/lib/fonts.ts`: `sourceSerif` → CSS variable `--font-english`, weight axis
  `200 900`, `display: 'swap'`, `preload: false` (Arabic pages share the layout and never need
  it), `adjustFontFallback: 'Times New Roman'` to keep the swap quiet.
- `frontend/src/app/globals.css`: `--font-sans` and `--font-heading` → `--font-english`; new
  `font-english` utility. English `<body>` uses `font-english` (`[locale]/layout.tsx`).
- `frontend/src/app/site-public.css`:
  - `html[lang=en] .site-public`: Source Serif 4, **18px / 1.75** desktop, **17px** at ≤650px.
  - English prose (`.page-lead`, about copy, pathway/deed descriptions, footer):
    line-height 1.7 (the Arabic 1.9–2.15 is too open for Latin).
  - English headings: line-height 1.25–1.3 (`.page-heading h1`, home h1, pathway titles, card
    titles); h1 tracking −0.4px.
  - `.quran`, `.featured-verse`, `.source-mark-title`, `.brand-message` switch to the English face
    only when `:lang(en)`; the Arabic stays Amiri / Amiri Quran.
  - Featured English text: 28 / 22 / 19px (short / medium / long), 23 / 19 / 17px on phones.
  - Phone breadcrumbs 13px; the branches card description 11px (was 10px, too small in Latin).
- Quote translations (`QuoteBody`): 16.5px → 18px at `md`, leading 1.75, `max-w-[68ch]`;
  hero 18 → 21px. Study panel English: 16.5 → 17px.

Before/after pages for comparison: `before/*-en-*.png` and `after/*-en-*.png` in this folder
(home, topic pages, quote, about, at 1440 and 390, light and dark).
