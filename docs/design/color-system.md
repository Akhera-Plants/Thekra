# Thekra (ذكرى) Colour System — Scholar's Desk

> **Version:** 3.0 — Scholar's Desk palette. Replaces the Sakina parchment palette (v2).
> Source of truth: `:root` / `.dark` in `frontend/src/app/globals.css`.
> ONE palette for all pages; no page carries its own colour overrides.

Swatch specimen: `docs/design/after/system/palette-swatch.png`

---

## 1. Source world

**A scholar's desk at night reading a printed classical Arabic book.**

This world is specific and gives every colour a reason grounded in material reality:

| Material | Colour |
|---|---|
| Printed book paper | Near-neutral white — not warm cream, not stark white |
| Carbon ink on paper | Near-neutral near-black — not warm brown, not navy |
| Brass desk lamp patina | Verdigris — `oklch(0.42 0.075 195)` |
| Amber lamp light | Warm amber — `oklch(0.44 0.10 58)` |
| Ink on book cloth (branches) | Ink-slate blue — `oklch(0.42 0.07 262)` |
| Muted terracotta (error / warning) | Earth — `oklch(0.50 0.10 30)` |

**What this rejects on purpose:**
- Warm cream `oklch(0.975 0.012 75)` with warm-brown ink — the AI-default parchment+brown pair, not derived from this world
- "Calm tech" generic deep teal — valid for wellness apps generically, not specific to this desk

---

## 2. Neutral ramp (near-achromatic, chroma ≤ 0.008)

Printed paper is near-achromatic. The tiny chroma values (≤0.008) are barely perceptible; they exist to prevent the flatness of pure grey while staying clearly neutral. Light hue 90 = trace lamp warmth; dark hue 255 = trace carbon-ink slate. Neither reads as cream, brown, or navy.

| Step | Value | Role |
|---|---|---|
| n-50 | `oklch(0.98 0.004 90)` | Page white — `--background` (light) |
| n-100 | `oklch(0.97 0.004 90)` | Card paper — `--card` (light) |
| n-200 | `oklch(0.92 0.005 90)` | Recessed surface — `--muted`, `--secondary`, `--accent` (light) |
| n-300 | `oklch(0.87 0.006 90)` | Hairline rule — `--border`, `--input` (light) |
| n-500 | `oklch(0.44 0.007 90)` | Soft ink — `--muted-foreground` (light) |
| n-900 | `oklch(0.18 0.007 255)` | Carbon ink — `--foreground` (light) |
| d-50 | `oklch(0.97 0.004 90)` | Page white text — `--foreground` (dark) |
| d-300 | `oklch(0.68 0.006 90)` | Soft page text — `--muted-foreground` (dark) |
| d-800 | `oklch(0.22 0.007 255)` | Card surface — `--card` (dark) |
| d-850 | `oklch(0.18 0.007 255)` | Background — `--background` (dark) |
| d-border | `oklch(0.32 0.007 255)` | Rule — `--border`, `--input` (dark) |

---

## 3. Brand accent — Verdigris

**One accent only.** `oklch(0.42 0.075 195)` light / `oklch(0.65 0.08 195)` dark.

Verdigris is the patina on a brass desk lamp, a copper inkwell, brass book-spine finials — objects that are literally on this desk. It is blue-green (hue 195) with modest chroma (0.075), reading as patinated metal rather than a "calm tech" default. It is the primary action colour, the focus ring, and the sin-path identity (introspection — the register of looking inward in lamp-light).

---

## 4. Three path tones (equal lightness, coherent family, never large fills)

Equal lightness (L≈0.42 light, L≈0.65 dark) means no path dominates visually. All three come from the desk world. They are used only for path identity — card border tints, subtle gradient washes, icon colour — never as solid large fills or backgrounds.

| Path | Hue | Light | Dark | World source | Register |
|---|---|---|---|---|---|
| Sin | 195 (Verdigris) | `oklch(0.42 0.075 195)` | `oklch(0.65 0.08 195)` | Brass lamp patina | Introspection, inward |
| Good deed | 58 (Amber) | `oklch(0.44 0.10 58)` | `oklch(0.67 0.11 58)` | Lamp light warmth | Warmth, reward, action |
| Branches | 262 (Ink slate) | `oklch(0.42 0.07 262)` | `oklch(0.65 0.08 262)` | Ink on book cloth | Depth, contemplation |

The sin path shares the verdigris hue with the brand accent — deliberate. The sin-reminder path is where someone brings their hardest burden; it should signal the same calm safety as the product's primary action.

---

## 5. Full semantic token mapping

### Light

| Token | Value | Reason |
|---|---|---|
| `--background` | `oklch(0.98 0.004 90)` | Printed paper (n-50) |
| `--foreground` | `oklch(0.18 0.007 255)` | Carbon ink (n-900) |
| `--card` | `oklch(0.97 0.004 90)` | Card paper (n-100) |
| `--muted`, `--secondary`, `--accent` | `oklch(0.92 0.005 90)` | Recessed surface (n-200) |
| `--muted-foreground` | `oklch(0.44 0.007 90)` | Soft ink (n-500) |
| `--border`, `--input` | `oklch(0.87 0.006 90)` | Hairline rule (n-300) |
| `--primary` | `oklch(0.42 0.075 195)` | Verdigris (a-400) |
| `--primary-foreground` | `oklch(0.98 0.004 90)` | Page white on verdigris (7.7:1) |
| `--ring` | `oklch(0.42 0.075 195)` | Focus ring = accent |
| `--destructive` | `oklch(0.50 0.10 30)` | Muted terracotta, not alarm-red |
| `--intent-sin` | `oklch(0.42 0.075 195)` | Verdigris (= primary) |
| `--intent-good-deed` | `oklch(0.44 0.10 58)` | Amber lamp |
| `--intent-iman-branch` | `oklch(0.42 0.07 262)` | Ink slate |
| `--folio` | `oklch(0.99 0.003 90)` | Brightest paper (above card) |
| `--folio-edge` | `oklch(0.85 0.006 90)` | Neutral hairline |
| `--folio-ink` | `oklch(0.18 0.007 255)` | Carbon ink |

### Dark

| Token | Value | Reason |
|---|---|---|
| `--background` | `oklch(0.18 0.007 255)` | Carbon ink background (d-850) |
| `--foreground` | `oklch(0.97 0.004 90)` | Page white text (d-50) |
| `--card` | `oklch(0.22 0.007 255)` | Slightly lighter surface (d-800) |
| `--muted`, `--secondary` | `oklch(0.26 0.007 255)` | Recessed surface |
| `--muted-foreground` | `oklch(0.68 0.006 90)` | Soft page text (d-300) |
| `--border`, `--input` | `oklch(0.32 0.007 255)` | Visible but quiet rule |
| `--primary` | `oklch(0.65 0.08 195)` | Verdigris lighter (a-600) |
| `--primary-foreground` | `oklch(0.18 0.007 255)` | Carbon on verdigris (5.9:1) |
| `--folio` | `oklch(0.24 0.007 255)` | Same neutral family as card — not navy |
| `--folio-edge` | `oklch(0.34 0.007 255)` | Neutral hairline |
| `--folio-ink` | `oklch(0.97 0.004 90)` | Page white |

---

## 6. Contrast table (WCAG AA — both themes)

AA requires ≥4.5:1 for normal text, ≥3:1 for large text and non-text UI.
Values computed via OKLCH→OKLab→linear-sRGB→relative luminance (WCAG formula).

### Light theme

| Pair | Ratio | Verdict |
|---|---|---|
| `foreground` / `background` | 17.75:1 | ✅ AAA |
| `foreground` / `card` | 16.74:1 | ✅ AAA |
| `muted-foreground` / `background` | 7.33:1 | ✅ AA |
| `muted-foreground` / `muted` (n-200) | 6.13:1 | ✅ AA |
| `primary-foreground` / `primary` (verdigris) | 7.66:1 | ✅ AA |
| `intent-sin-fg` / `intent-sin` | 7.66:1 | ✅ AA |
| `intent-good-deed-fg` / `intent-good-deed` | 7.58:1 | ✅ AA |
| `intent-iman-branch-fg` / `intent-iman-branch` | 8.03:1 | ✅ AA |
| `grade-daif-fg` (n-900) / `grade-daif` | 4.77:1 | ✅ AA |
| `ring` / `background` (focus ring, 3:1 threshold) | 7.66:1 | ✅ |
| `folio-ink` / `folio` | 18.27:1 | ✅ AAA |

### Dark theme

| Pair | Ratio | Verdict |
|---|---|---|
| `foreground` / `background` | 16.93:1 | ✅ AAA |
| `foreground` / `card` | 15.87:1 | ✅ AAA |
| `muted-foreground` / `background` | 6.41:1 | ✅ AA |
| `muted-foreground` / `muted` | 6.01:1 | ✅ AA |
| `primary-foreground` / `primary` | 5.93:1 | ✅ AA |
| `intent-sin-fg` / `intent-sin` | 5.92:1 | ✅ AA |
| `intent-good-deed-fg` / `intent-good-deed` | 6.10:1 | ✅ AA |
| `intent-iman-branch-fg` / `intent-iman-branch` | 5.69:1 | ✅ AA |
| `grade-daif-fg` (d-50) / `grade-daif` | 5.05:1 | ✅ AA |
| `ring` / `background` (focus ring) | 5.93:1 | ✅ |
| `folio-ink` / `folio` | 15.08:1 | ✅ AAA |

---

## 7. Bookshelf cloth colours

Three surface colours for book spine cloth, matching path-intent hue families at saturated values (printed-book feel):

| Class | Background | Foreground | Path |
|---|---|---|---|
| `.book-cloth-a` | `oklch(0.32 0.06 262)` | `oklch(0.97 0.004 90)` | Branches / ink slate |
| `.book-cloth-b` | `oklch(0.38 0.09 58)` | `oklch(0.97 0.004 90)` | Good deeds / amber |
| `.book-cloth-c` | `oklch(0.34 0.07 195)` | `oklch(0.97 0.004 90)` | Sins / verdigris |

---

## 8. Changes from v2 (Sakina parchment)

| Before (v2) | After (v3) | Reason |
|---|---|---|
| Background: warm cream `oklch(0.975 0.012 75)` | Near-neutral `oklch(0.98 0.004 90)` | Cream reads as AI-generated default; printed paper is near-achromatic |
| Foreground: warm brown `oklch(0.24 0.025 50)` | Carbon ink `oklch(0.18 0.007 255)` | Warm brown is the other half of the AI-default pair |
| Primary: "calm teal" `oklch(0.4 0.07 185)` | Verdigris `oklch(0.42 0.075 195)` | Same hue family; verdigris is derived from the desk world, not generic |
| Dark `--folio`: navy `oklch(0.205 0.035 258)` | Neutral `oklch(0.24 0.007 255)` | Navy was a leftover from the removed home-sky; folio is now the same near-neutral family |
| `--grade-daif`: terracotta-grey `oklch(0.62 0.02 60)` | Neutral grey `oklch(0.60 0.007 90)` | Grade-daif should not read as a hue; pure neutral is more de-emphasised |
| `segment.ts` + `segment.spec.ts` | Deleted | No longer referenced; Verse.tsx rewrote to use `verse.text` directly |
| `.home-lamp-*` CSS classes | Deleted | No longer referenced after Verse rewrite |
