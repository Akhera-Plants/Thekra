/**
 * Browser-only: draws the share image on an offscreen canvas. The browser shapes Arabic and
 * runs the bidi algorithm, so the canvas gets the same letters the page shows.
 *
 * Colours come from the site's CSS tokens (resolved through getComputedStyle, never literals);
 * faces come from the next/font CSS variables and are loaded before anything is measured.
 */

import {
  layoutShareImage,
  SHARE_IMAGE,
  type ShareImageFit,
  type ShareImageLayout,
  type ShareTextRole,
} from './image-layout';
import { isArabicLine, type SharePayload } from './share-text';

interface Faces {
  body: string;
  meta: string;
  heading: string;
}

interface Palette {
  background: string;
  card: string;
  border: string;
  foreground: string;
  muted: string;
  primary: string;
}

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Resolves a colour token (also `color-mix`/`oklch` values) to a colour the canvas accepts. */
function resolveColor(token: string): string {
  const probe = document.createElement('span');
  probe.style.display = 'none';
  probe.style.color = `var(${token})`;
  document.body.appendChild(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
}

function readPalette(): Palette {
  return {
    background: resolveColor('--background'),
    card: resolveColor('--card'),
    border: resolveColor('--border'),
    foreground: resolveColor('--foreground'),
    muted: resolveColor('--muted-foreground'),
    primary: resolveColor('--primary'),
  };
}

/** Font stacks from the next/font variables; the other script's face follows as a fallback. */
function readFaces(payload: SharePayload, uiLocale: 'ar' | 'en'): Faces {
  const quran = cssVar('--font-quran');
  const arabicText = cssVar('--font-arabic-text');
  const arabicUi = cssVar('--font-arabic-ui');
  const english = cssVar('--font-english');
  // Amiri (the site's Quran/wordmark face) follows the reading faces: it draws «ﷺ», which the
  // Thmanyah faces lack (the sans face even maps it to a placeholder glyph).
  const amiri = cssVar('--font-amiri');
  const stack = (...families: string[]) => [...families.filter(Boolean), 'serif'].join(', ');
  const body =
    payload.bodyFace === 'quran'
      ? stack(quran, amiri)
      : payload.bodyFace === 'arabic'
        ? stack(arabicText, amiri)
        : stack(english, arabicText, amiri);
  const meta = uiLocale === 'ar' ? stack(arabicUi, english) : stack(english, arabicUi);
  return { body, meta, heading: meta };
}

function fontFor(faces: Faces, role: ShareTextRole, size: number): string {
  if (role === 'body') return `400 ${size}px ${faces.body}`;
  if (role === 'heading' || role === 'footer') return `600 ${size}px ${faces.heading}`;
  return `400 ${size}px ${faces.meta}`;
}

/**
 * Loads every face (and every unicode-range subset) the drawing will use. Each family is loaded
 * on its own and failures are tolerated: next/font's metric fallbacks point at `local()` fonts
 * (e.g. «Times New Roman») that many devices lack, and one missing fallback must not block the
 * site faces that did load.
 */
async function loadFaces(faces: Faces, payload: SharePayload, footer: string[]): Promise<void> {
  if (!('fonts' in document)) return;
  const metaText = [payload.heading, ...payload.attribution, ...footer].join(' ');
  const families = (stack: string) =>
    stack
      .split(',')
      .map((family) => family.trim())
      .filter((family) => family && family !== 'serif' && !/fallback/i.test(family));
  const requests = [
    ...families(faces.body).map((family) => [`400 48px ${family}`, payload.body] as const),
    ...families(faces.meta).map((family) => [`400 28px ${family}`, metaText] as const),
    ...families(faces.heading).map((family) => [`600 30px ${family}`, metaText] as const),
  ];
  await Promise.allSettled(requests.map(([font, text]) => document.fonts.load(font, text)));
  await document.fonts.ready;
}

function lineDirection(line: string, fallback: CanvasDirection): CanvasDirection {
  if (isArabicLine(line)) return 'rtl';
  if (!/[؀-ۿ]/.test(line)) return 'ltr';
  return fallback;
}

export interface PreparedShareImage {
  layout: ShareImageLayout;
  draw: () => Promise<Blob>;
}

/**
 * Loads the faces, measures, and returns the layout plus a function that draws the PNG.
 * `layout.fits === false` means the image is not offered for this text.
 */
export async function prepareShareImage(
  payload: SharePayload,
  options: { uiLocale: 'ar' | 'en'; siteName: string; host: string },
): Promise<PreparedShareImage> {
  const footer = [options.siteName, options.host];
  const faces = readFaces(payload, options.uiLocale);
  await loadFaces(faces, payload, footer);

  const canvas = document.createElement('canvas');
  canvas.width = SHARE_IMAGE.width;
  canvas.height = SHARE_IMAGE.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');

  const bodyDir: CanvasDirection = payload.bodyLang === 'ar' ? 'rtl' : 'ltr';
  const uiDir: CanvasDirection = options.uiLocale === 'ar' ? 'rtl' : 'ltr';

  const layout = layoutShareImage(
    { body: payload.body, bodyFace: payload.bodyFace, attribution: payload.attribution },
    (text, size, role) => {
      ctx.font = fontFor(faces, role, size);
      ctx.direction = role === 'body' ? bodyDir : lineDirection(text, uiDir);
      return ctx.measureText(text).width;
    },
  );

  return {
    layout,
    draw: () => {
      if (!layout.fits) return Promise.reject(new Error('text does not fit the image'));
      drawImage(ctx, layout, payload, faces, footer, { bodyDir, uiDir });
      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/png');
      });
    },
  };
}

function drawImage(
  ctx: CanvasRenderingContext2D,
  layout: ShareImageFit,
  payload: SharePayload,
  faces: Faces,
  footer: string[],
  dirs: { bodyDir: CanvasDirection; uiDir: CanvasDirection },
): void {
  const m = SHARE_IMAGE;
  const palette = readPalette();
  const centerX = m.width / 2;

  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, m.width, m.height);

  const inset = m.frameInset;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(inset, inset, m.width - 2 * inset, m.height - 2 * inset, 36);
  } else {
    ctx.rect(inset, inset, m.width - 2 * inset, m.height - 2 * inset);
  }
  ctx.fillStyle = palette.card;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = palette.border;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Heading: the type label («آية قرآنية», «حديث نبوي», «أثر»).
  ctx.font = fontFor(faces, 'heading', m.headingSize);
  ctx.direction = lineDirection(payload.heading, dirs.uiDir);
  ctx.fillStyle = palette.primary;
  ctx.fillText(payload.heading, centerX, layout.headingTop + (m.headingSize * 1.4) / 2);

  // Body: every line, never cut.
  ctx.font = fontFor(faces, 'body', layout.fontSize);
  ctx.direction = dirs.bodyDir;
  ctx.fillStyle = palette.foreground;
  layout.bodyLines.forEach((line, index) => {
    ctx.fillText(line, centerX, layout.bodyTop + index * layout.lineHeight + layout.lineHeight / 2);
  });

  // A short rule between the text and its attribution.
  const ruleY = layout.metaTop - m.bodyMetaGap / 2;
  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(centerX - 60, ruleY);
  ctx.lineTo(centerX + 60, ruleY);
  ctx.stroke();

  ctx.font = fontFor(faces, 'meta', m.metaSize);
  ctx.fillStyle = palette.muted;
  layout.metaLines.forEach((line, index) => {
    ctx.direction = lineDirection(line, dirs.uiDir);
    ctx.fillText(
      line,
      centerX,
      layout.metaTop + index * layout.metaLineHeight + layout.metaLineHeight / 2,
    );
  });

  // Footer: site name, then its address.
  const [name, host] = footer;
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(m.paddingX, layout.footerTop);
  ctx.lineTo(m.width - m.paddingX, layout.footerTop);
  ctx.stroke();

  ctx.font = fontFor(faces, 'footer', m.footerNameSize);
  ctx.direction = lineDirection(name, dirs.uiDir);
  ctx.fillStyle = palette.primary;
  ctx.fillText(name, centerX, layout.footerTop + 36);

  ctx.font = fontFor(faces, 'meta', m.footerHostSize);
  ctx.direction = 'ltr';
  ctx.fillStyle = palette.muted;
  ctx.fillText(host, centerX, layout.footerTop + 74);
}
