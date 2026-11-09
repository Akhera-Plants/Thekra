/**
 * The share image on the web build (round 6, C-08, design b): a 1080 × 1350 PNG drawn on a canvas — the primary green,
 * the type pill, the text centred and word-wrapped at the largest size that fits (never cut: when even the smallest
 * readable size does not fit, the caller is told and the text share remains), the source, then the wordmark, «بواسطة
 * تطبيق ذكرى» and the site. Handed to the browser's share sheet with the file when it can take one, else downloaded.
 * Native builds have no canvas here and get `failed` (the sheet offers the text there).
 */

import { Platform } from 'react-native';
import type { ShareCardContent } from '@/components/share/ShareSheet';

const W = 1080;
const H = 1350;
const PAD = 104;
const GREEN = '#326c59';
const BODY_MAX = 60;
const BODY_MIN = 34;

export type ShareImageResult = 'shared' | 'downloaded' | 'failed';

/** Greedy word wrap with the canvas's own measure. */
export function wrapWords(words: readonly string[], maxWidth: number, measure: (text: string) => number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next) > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export async function shareCardImage(c: ShareCardContent, ink: { ink: string; soft: string }): Promise<ShareImageResult> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return 'failed';
  try {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'failed';
    await document.fonts?.ready;
    const body = c.quran ? 'AmiriQuran-Regular' : 'Plex-Regular';
    ctx.fillStyle = GREEN;
    ctx.fillRect(0, 0, W, H);
    ctx.direction = c.rtl ? 'rtl' : 'ltr';
    ctx.textBaseline = 'alphabetic';

    // Type pill, at the reading start.
    ctx.font = '30px Plex-Medium';
    const pillW = ctx.measureText(c.kicker).width + 48;
    const pillX = c.rtl ? W - PAD - pillW : PAD;
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    ctx.beginPath();
    ctx.roundRect?.(pillX, PAD, pillW, 56, 28);
    ctx.fill();
    ctx.fillStyle = ink.ink;
    ctx.textAlign = 'center';
    ctx.fillText(c.kicker, pillX + pillW / 2, PAD + 39);

    // Footer: a hairline, the wordmark and «بواسطة…» at the start, the host at the end.
    const footY = H - PAD;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PAD, footY - 64);
    ctx.lineTo(W - PAD, footY - 64);
    ctx.stroke();
    ctx.textAlign = c.rtl ? 'right' : 'left';
    ctx.font = '56px Amiri-Regular';
    const startX = c.rtl ? W - PAD : PAD;
    ctx.fillText(c.wordmark, startX, footY);
    const markW = ctx.measureText(c.wordmark).width;
    ctx.font = '26px Plex-Regular';
    ctx.fillStyle = ink.soft;
    ctx.fillText(c.via, c.rtl ? startX - markW - 20 : startX + markW + 20, footY - 6);
    ctx.textAlign = c.rtl ? 'left' : 'right';
    ctx.direction = 'ltr';
    ctx.fillText(c.host, c.rtl ? PAD : W - PAD, footY - 6);
    ctx.direction = c.rtl ? 'rtl' : 'ltr';

    // Source lines above the footer.
    const sourceLines = c.source ? c.source.split('\n') : [];
    ctx.font = '30px Plex-Regular';
    ctx.textAlign = 'center';
    const sourceH = sourceLines.length * 46;
    const top = PAD + 56 + 60;
    const bottom = footY - 64 - 48 - sourceH - 40;

    // The body at the largest size that fits between the pill and the source.
    const words = c.body.split(/\s+/).filter(Boolean);
    let size = BODY_MAX;
    let lines: string[] = [];
    let lineH = 0;
    for (; size >= BODY_MIN; size -= 2) {
      ctx.font = `${size}px ${body}`;
      lineH = size * (c.quran ? 1.9 : 1.75);
      lines = wrapWords(words, W - PAD * 2, (text) => ctx.measureText(text).width);
      if (lines.length * lineH <= bottom - top) break;
    }
    if (size < BODY_MIN) return 'failed';
    ctx.fillStyle = ink.ink;
    const blockTop = top + (bottom - top - lines.length * lineH) / 2;
    lines.forEach((line, i) => ctx.fillText(line, W / 2, blockTop + (i + 0.75) * lineH));
    ctx.fillStyle = ink.soft;
    ctx.font = '30px Plex-Regular';
    sourceLines.forEach((line, i) => ctx.fillText(line, W / 2, bottom + 40 + (i + 0.75) * 46));

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return 'failed';
    const file = new File([blob], 'thekra.png', { type: 'image/png' });
    const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file] });
        return 'shared';
      } catch {
        return 'shared';
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'thekra.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}
