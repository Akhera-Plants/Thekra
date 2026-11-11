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
import { isArabicLine, naturalBody, type SharePayload } from './share-text';

interface Faces {
  body: string;
  meta: string;
  heading: string;
}

interface Palette {
  /** The «أعنّي على فعل طاعة» door's fill (round 6, C-08 option b): the card. */
  door: string;
  /** Its ink: the text, the chip and the footer. */
  ink: string;
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
    door: resolveColor('--primary'),
    ink: resolveColor('--primary-foreground'),
  };
}

/** The leaf of the «أعنّي على فعل طاعة» door (components/home/DoorArt.tsx), drawn faint in the card's corner. */
const LEAF_PATHS = [
  'M110 258c13-50 10-117 45-195M123 189c-56-7-73-41-59-79 36 1 61 30 59 79ZM132 156c47-7 77-37 66-75-37 2-65 30-66 75ZM142 111c-33-18-40-52-20-78 25 11 32 39 20 78ZM155 63c-3-28 9-48 31-53 8 26-7 48-31 53Z',
  'M66 112c20 26 39 52 57 77M132 156c19-25 40-49 66-75M123 34c8 27 15 53 19 77M155 63l31-53',
];

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
  // Footer (C-08): «بواسطة تطبيق ذكرى» and the site's address, each on one line.
  const footer = [payload.byline, options.host];
  void options.siteName;
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
    { body: naturalBody(payload.body), bodyFace: payload.bodyFace, attribution: payload.attribution },
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

/**
 * Option b of the owner's share choices (round 6, C-08): a card in the door's green, a chip with the text's type at
 * the top, the text in the middle (every line, never cut), its source under a short rule, then a footer line with
 * «بواسطة تطبيق ذكرى» on the reading start and the site's address on the end (one line each, never wrapped). The leaf
 * of the door sits faint in a corner. Colours are the site's tokens.
 */
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
  const rtl = dirs.uiDir === 'rtl';

  ctx.fillStyle = palette.door;
  ctx.fillRect(0, 0, m.width, m.height);

  // The leaf, faint, from the bottom corner on the reading start side.
  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 1.2;
  const scale = 2.2;
  ctx.translate(rtl ? m.width - 40 - 240 * scale * 0.55 : -40, m.height - 260 * scale - 60);
  ctx.scale(scale, scale);
  for (const d of LEAF_PATHS) ctx.stroke(new Path2D(d));
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // The type chip («آية قرآنية», «حديث نبوي», «أثر»).
  ctx.font = fontFor(faces, 'heading', m.headingSize);
  ctx.direction = lineDirection(payload.heading, dirs.uiDir);
  const chipW = ctx.measureText(payload.heading).width + 56;
  const chipH = m.headingSize * 1.9;
  const chipY = layout.headingTop + (m.headingSize * 1.4) / 2;
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = palette.ink;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(centerX - chipW / 2, chipY - chipH / 2, chipW, chipH, chipH / 2);
  else ctx.rect(centerX - chipW / 2, chipY - chipH / 2, chipW, chipH);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = palette.ink;
  ctx.fillText(payload.heading, centerX, chipY);

  // Body: every line, never cut.
  ctx.font = fontFor(faces, 'body', layout.fontSize);
  ctx.direction = dirs.bodyDir;
  ctx.fillStyle = palette.ink;
  layout.bodyLines.forEach((line, index) => {
    ctx.fillText(line, centerX, layout.bodyTop + index * layout.lineHeight + layout.lineHeight / 2);
  });

  // A short rule between the text and its attribution.
  const ruleY = layout.metaTop - m.bodyMetaGap / 2;
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(centerX - 60, ruleY);
  ctx.lineTo(centerX + 60, ruleY);
  ctx.stroke();
  ctx.restore();

  ctx.font = fontFor(faces, 'meta', m.metaSize);
  ctx.fillStyle = palette.ink;
  ctx.save();
  ctx.globalAlpha = 0.85;
  layout.metaLines.forEach((line, index) => {
    ctx.direction = lineDirection(line, dirs.uiDir);
    ctx.fillText(line, centerX, layout.metaTop + index * layout.metaLineHeight + layout.metaLineHeight / 2);
  });
  ctx.restore();

  // Footer: a hairline, then «بواسطة تطبيق ذكرى» on the reading start and the address on the end.
  const [byline, host] = footer;
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(m.paddingX, layout.footerTop);
  ctx.lineTo(m.width - m.paddingX, layout.footerTop);
  ctx.stroke();
  ctx.restore();

  const footerY = layout.footerTop + m.footerHeight / 2;
  const startX = rtl ? m.width - m.paddingX : m.paddingX;
  const endX = rtl ? m.paddingX : m.width - m.paddingX;
  ctx.fillStyle = palette.ink;
  ctx.font = fontFor(faces, 'footer', m.footerHostSize + 4);
  ctx.direction = lineDirection(byline ?? '', dirs.uiDir);
  ctx.textAlign = rtl ? 'right' : 'left';
  ctx.fillText(byline ?? '', startX, footerY);
  ctx.font = fontFor(faces, 'meta', m.footerHostSize);
  ctx.direction = 'ltr';
  ctx.textAlign = rtl ? 'left' : 'right';
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillText(host ?? '', endX, footerY);
  ctx.restore();
}
