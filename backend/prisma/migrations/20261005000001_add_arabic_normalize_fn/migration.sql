-- Migration: 20261005000001_add_arabic_normalize_fn
--
-- Creates a PostgreSQL function that applies the same normalisation rules as the
-- TypeScript `normalizeArabic()` helper so that ILIKE searches work on stored
-- Arabic text that may contain tashkeel or alef/ya/ta-marbuta variants.
--
-- Rules (must stay in sync with src/common/text/arabic-normalizer.ts):
--   1. Strip tashkeel    U+064B–U+0652  (ً ٌ ٍ َ ُ ِ ّ ْ)
--   2. Strip superscript alef  U+0670   (ٰ)
--   3. Strip tatweel     U+0640         (ـ)
--   4. Strip extended Arabic marks U+06D6–U+06ED
--   5. Fold أ(U+0623) إ(U+0625) آ(U+0622) ٱ(U+0671)  →  ا(U+0627)
--   6. Fold ى(U+0649) → ي(U+064A)
--   7. Fold ة(U+0629) → ه(U+0647)
--
-- Implementation notes:
--   `translate(str, from, to)` deletes characters in `from` that have no
--   counterpart in `to` (when |from| > |to|) — perfect for stripping diacritics.
--   `replace(str, old, new)` handles simple single-character substitution.
--
-- Future: backend-plan §4.4 Phase 5 will add a GIN trigram index on
--   thekra_normalize_ar("textAr") to eliminate sequential scans on Quote.

CREATE OR REPLACE FUNCTION thekra_normalize_ar(input text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
  RETURNS NULL ON NULL INPUT
AS $$
  SELECT
    -- 7. fold ة (U+0629) → ه (U+0647)
    replace(
      -- 6. fold ى (U+0649) → ي (U+064A)
      replace(
        -- 5. fold أ إ آ ٱ → ا  (each variant maps to ا)
        translate(
          -- 1-4. strip diacritics and formatting marks
          --   from: tashkeel U+064B-U+0652, superscript alef U+0670,
          --         tatweel U+0640, extended marks U+06D6-U+06ED
          --   to:   '' (shorter than from → extra chars are deleted)
          translate(
            input,
            U&'\064B\064C\064D\064E\064F\0650\0651\0652'  -- tashkeel ً ٌ ٍ َ ُ ِ ّ ْ
              || U&'\0670'                                  -- superscript alef ٰ
              || U&'\0640'                                  -- tatweel ـ
              || U&'\06D6\06D7\06D8\06D9\06DA\06DB\06DC\06DD\06DE\06DF'
              || U&'\06E0\06E1\06E2\06E3\06E4\06E5\06E6\06E7\06E8\06E9\06EA\06EB\06EC\06ED',
            ''
          ),
          U&'\0623\0625\0622\0671',   -- أ إ آ ٱ (alef variants)
          U&'\0627\0627\0627\0627'    -- ا ا ا ا (base alef × 4)
        ),
        U&'\0649',                    -- ى (alef maqsura)
        U&'\064A'                     -- ي (ya)
      ),
      U&'\0629',                      -- ة (ta marbuta)
      U&'\0647'                       -- ه (ha)
    )
$$;
