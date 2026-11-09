/**
 * «مشاركة» of one text (owner round 6, C-08): ONE share button on the card opens this sheet with two choices.
 * - «نص» (the system share sheet): the text as one flowing paragraph in its marks, its attribution, then «بواسطة تطبيق
 *   ذكرى» and the link (src/lib/share/quote-share.ts `quoteShareText`). Nothing about the user is ever shared.
 * - «صورة»: the card in the owner's chosen design (b: the filled door's green with its leaf drawing; the type and grade
 *   pill, the text in the middle, the source, then the Thekra wordmark, «بواسطة تطبيق ذكرى» and the site). On iOS and
 *   Android the preview card itself is captured to a 1080 × 1350 PNG (react-native-view-shot, a temporary file) and
 *   handed to the system share sheet (expo-sharing); the file is released afterwards. On the web build it is drawn to
 *   the same PNG and handed to the browser's share sheet (or downloaded). The text share stays one tap away.
 * A cancelled share shows nothing (no «تمت المشاركة» on a dismissal).
 */

import React, { useRef, useState } from 'react';
import { Platform, Share, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import { useTranslation } from 'react-i18next';
import { Image as ImageIcon, MessageSquareText } from 'lucide-react-native';
import type { QuoteDto } from '@/lib/types/api';
import { QuoteType } from '@/lib/types/enums';
import { quoteAttribution, quoteShareText, flowingText, type QuoteShareLabels } from '@/lib/share/quote-share';
import { SITE_URL } from '@/lib/site';
import { shareCardImage } from '@/lib/share/web-image';
import { DoorArt } from '@/components/home/HomeDoors';
import { QURAN_FONT, WORDMARK_FONT, radius, space, useStyles, useTheme, type Theme } from '@/theme';
import { BottomSheet, ButtonPair, SegmentTabs, Text, toast, type SegmentItem } from '@/ui';

type Mode = 'text' | 'image';

const makeStyles = (t: Theme) => ({
  card: {
    aspectRatio: 4 / 5,
    width: '100%' as const,
    maxWidth: 360,
    alignSelf: 'center' as const,
    borderRadius: 6,
    backgroundColor: t.colors.primary,
    paddingVertical: space.xl,
    paddingHorizontal: space.xl,
    overflow: 'hidden' as const,
    justifyContent: 'space-between' as const,
  },
  art: { position: 'absolute' as const, top: 40, bottom: 0, left: 0, right: 0, flexDirection: 'row' as const, justifyContent: 'flex-end' as const },
  artInner: { marginEnd: -40 },
  pill: {
    alignSelf: 'flex-start' as const,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  body: { flex: 1, justifyContent: 'center' as const, gap: space.md, paddingVertical: space.lg },
  footer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: space.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    paddingTop: space.sm,
  },
  brand: { flexDirection: 'row' as const, alignItems: 'baseline' as const, gap: space.sm, flexShrink: 1 },
  preview: { gap: space.md },
});

/** The ink on the green card (the website's `--pathway-return-*` light inks). */
const ON_GREEN = { ink: '#ffffff', soft: '#d8e6dd' } as const;

export function useShareLabels(): QuoteShareLabels {
  const { t } = useTranslation();
  return {
    atharNotice: t('share.atharNotice'),
    atharNarrated: (speaker) => t('share.atharNarrated', { speaker }),
    grade: { SAHIH: t('grade.SAHIH'), HASAN: t('grade.HASAN'), DAIF: t('grade.DAIF'), MAWDU: t('grade.MAWDU') },
    sharedVia: t('share.sharedVia'),
  };
}

export function ShareSheet({ quote, visible, onClose, showTranslation }: { quote: QuoteDto; visible: boolean; onClose: () => void; showTranslation: boolean }) {
  const { t, i18n } = useTranslation();
  const styles = useStyles(makeStyles);
  const labels = useShareLabels();
  const locale = i18n.language === 'en' ? 'en' : 'ar';
  const [mode, setMode] = useState<Mode>('text');
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<View>(null);
  const web = Platform.OS === 'web';
  const items: SegmentItem<Mode>[] = [
    { key: 'text', label: t('share.asText') },
    { key: 'image', label: t('share.asImage') },
  ];

  async function shareText() {
    const message = quoteShareText(quote, { locale, showTranslation, labels });
    try {
      await Share.share({ message });
      onClose();
    } catch {
      // Dismissed or unavailable: nothing to say.
    }
  }

  async function shareImage() {
    setBusy(true);
    try {
      if (web) {
        const result = await shareCardImage(cardContent(quote, labels, locale, t), { ink: ON_GREEN.ink, soft: ON_GREEN.soft });
        if (result === 'downloaded') toast(t('share.imageSaved'));
        if (result !== 'failed') onClose();
        else toast(t('share.imageFailed'));
        return;
      }
      const result = await shareCardOnPhone(cardRef, t('share.shareImage'));
      if (result === 'failed') toast(t('share.imageFailed'));
      else onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      title={t('share.action')}
      onClose={onClose}
      footer={
        mode === 'text' ? (
          <ButtonPair size="lg" primary={{ label: t('share.shareText'), icon: MessageSquareText, onPress: () => void shareText() }} secondary={{ label: t('common.cancel'), onPress: onClose }} />
        ) : (
          <ButtonPair size="lg" primary={{ label: t('share.shareImage'), icon: ImageIcon, onPress: () => void shareImage(), loading: busy }} secondary={{ label: t('common.cancel'), onPress: onClose }} />
        )
      }
    >
      <SegmentTabs items={items} value={mode} onChange={setMode} />
      {mode === 'text' ? (
        <Text variant="small" tone="muted" style={{ writingDirection: 'rtl' }}>
          {quoteShareText(quote, { locale, showTranslation, labels })}
        </Text>
      ) : (
        <View style={styles.preview}>
          <ShareCard ref={cardRef} quote={quote} labels={labels} locale={locale} />
        </View>
      )}
    </BottomSheet>
  );
}

/** The image's size: 4:5, as on the web (frontend share design b). */
const IMAGE_SIZE = { width: 1080, height: 1350 } as const;

/**
 * iOS / Android: the preview card captured to a PNG in the cache and handed to the system share sheet. `failed` when
 * the capture or the sheet is unavailable (the caller says so and the text share stays); a dismissed sheet is `shared`
 * too (nothing to say).
 */
async function shareCardOnPhone(card: React.RefObject<View | null>, dialogTitle: string): Promise<'shared' | 'failed'> {
  let uri: string | null = null;
  try {
    if (!card.current || !(await Sharing.isAvailableAsync())) return 'failed';
    uri = await captureRef(card, { format: 'png', quality: 1, result: 'tmpfile', ...IMAGE_SIZE });
    await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle });
    return 'shared';
  } catch {
    return 'failed';
  } finally {
    if (uri) releaseCapture(uri);
  }
}

export interface ShareCardContent {
  kicker: string;
  body: string;
  quran: boolean;
  source: string;
  wordmark: string;
  via: string;
  host: string;
  rtl: boolean;
}

/** What the card says, shared by the preview and the web drawing. */
export function cardContent(quote: QuoteDto, labels: QuoteShareLabels, locale: 'ar' | 'en', t: (k: string) => string): ShareCardContent {
  const quran = quote.type === QuoteType.QURAN_VERSE;
  const type = quote.isAthar ? t('quoteCard.type.athar') : quran ? t('quoteCard.type.quran') : quote.type === QuoteType.HADITH ? t('quoteCard.type.hadith') : t('quoteCard.type.scholar');
  const grade = quote.type === QuoteType.HADITH && !quote.isAthar && quote.hadith?.grade && quote.hadith.grade !== 'UNGRADED' ? labels.grade[quote.hadith.grade] : null;
  const text = flowingText(quote.textAr);
  return {
    kicker: grade ? `${type} · ${grade}` : type,
    body: quran ? `﴿${text}﴾` : `«${text}»`,
    quran,
    // The attribution without the grade (it is in the pill); an athar keeps its «أثر، وليس حديثًا».
    source: quoteAttribution(quote, { ...labels, grade: {} }, locale).join('\n'),
    wordmark: t('app.name'),
    via: labels.sharedVia ?? '',
    host: SITE_URL.replace(/^https?:\/\//, ''),
    rtl: true,
  };
}

/** The image card, design b: the preview, and on a phone the view that is captured (`collapsable={false}` keeps it). */
function ShareCard({ ref, quote, labels, locale }: { ref?: React.Ref<View>; quote: QuoteDto; labels: QuoteShareLabels; locale: 'ar' | 'en' }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const c = cardContent(quote, labels, locale, t);
  const long = c.body.length > 260;
  return (
    <View ref={ref} collapsable={false} style={styles.card} accessibilityLabel={`${c.kicker}. ${c.body}. ${c.source}`}>
      <View style={styles.art} pointerEvents="none">
        <View style={styles.artInner}>
          <DoorArt kind="deeds" color={colors.pathwayFlourish} opacity={0.22} width={160} height={220} />
        </View>
      </View>
      <View style={styles.pill}>
        <Text variant="caption" style={{ color: ON_GREEN.ink }}>
          {c.kicker}
        </Text>
      </View>
      <View style={styles.body}>
        <Text
          variant={c.quran ? 'quran' : 'reading'}
          align="center"
          style={{ color: ON_GREEN.ink, writingDirection: 'rtl', fontSize: long ? 15 : 19, lineHeight: long ? 28 : 36, ...(c.quran ? { fontFamily: QURAN_FONT } : null) }}
          numberOfLines={14}
        >
          {c.body}
        </Text>
        {c.source ? (
          <Text variant="caption" align="center" style={{ color: ON_GREEN.soft }}>
            {c.source}
          </Text>
        ) : null}
      </View>
      <View style={styles.footer}>
        <View style={styles.brand}>
          <Text style={{ color: ON_GREEN.ink, fontFamily: WORDMARK_FONT, fontSize: 22, lineHeight: 30 }}>{c.wordmark}</Text>
          <Text variant="caption" style={{ color: ON_GREEN.soft }} numberOfLines={1}>
            {c.via}
          </Text>
        </View>
        <Text variant="caption" style={{ color: ON_GREEN.soft, writingDirection: 'ltr' }} numberOfLines={1}>
          {c.host}
        </Text>
      </View>
    </View>
  );
}
