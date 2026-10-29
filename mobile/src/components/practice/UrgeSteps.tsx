/**
 * The steps of «لحظة الضعف» (app/practice/pause.tsx). Calm and unhurried: no countdown, every step can be passed
 * with «التالي», and the breathing circle stays still when the system asks for reduced motion.
 * Wording: catalog (`common.urgeMoment`) and i18n; texts: the API only.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Share, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { BellRing, Check, Share2 } from 'lucide-react-native';
import { useMyCircles, useSendCheer } from '@/lib/api/circles';
import { circleErrorKey } from '@/lib/circles/circle-view';
import { pick, type UrgeMoment } from '@/lib/practice/catalog-types';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { scheduleUrgeCheckBack } from '@/lib/practice/urge-moment';
import type { CircleSummary } from '@/lib/types/circles';
import { radius, space, useStyles, type Theme } from '@/theme';
import { Button, CheckRow, ErrorText, Notice, Text } from '@/ui';

const INHALE_MS = 4000;
const EXHALE_MS = 6000;
const CIRCLE_SIZE = 168;
const CIRCLE_REST = 0.62;

const makeStyles = (t: Theme) => ({
  block: { gap: space.md },
  options: { gap: space.sm },
  dots: { flexDirection: 'row' as const, gap: space.sm, alignItems: 'center' as const },
  dot: { width: 8, height: 8, borderRadius: radius.full, backgroundColor: t.colors.border },
  dotOn: { backgroundColor: t.colors.primary },
  pacer: { alignItems: 'center' as const, gap: space.lg, paddingVertical: space.xl },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: t.colors.primary,
    backgroundColor: t.colors.primarySoft,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
});

/** A quiet row of dots: where you are, never how long is left. */
export function ProgressDots({ index, total }: { index: number; total: number }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const label = t('sinProgram.urge.progress', { n: String(Math.min(index + 1, total)), total: String(total) });
  return (
    <View style={styles.dots} accessibilityRole="progressbar" accessibilityLabel={label}>
      {Array.from({ length: total }, (_, i) => (
        <View key={`dot-${i}`} style={[styles.dot, i <= index && styles.dotOn]} />
      ))}
    </View>
  );
}

/** True while the system asks for reduced motion. */
function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => mounted && setReduced(value));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}

/** Slow breaths: in for 4 seconds, out for 6. The circle grows and settles (still under reduced motion). */
export function BreathPacer({ breaths }: { breaths: number }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const reduced = useReduceMotion();
  const scale = useRef(new Animated.Value(CIRCLE_REST)).current;
  const [breath, setBreath] = useState(1);
  const [phase, setPhase] = useState<'in' | 'out' | 'done'>('in');

  useEffect(() => {
    if (phase === 'done') return;
    const timer = setTimeout(
      () => {
        if (phase === 'in') setPhase('out');
        else if (breath < breaths) {
          setBreath((b) => b + 1);
          setPhase('in');
        } else setPhase('done');
      },
      phase === 'in' ? INHALE_MS : EXHALE_MS,
    );
    return () => clearTimeout(timer);
  }, [phase, breath, breaths]);

  useEffect(() => {
    if (reduced) return;
    const animation = Animated.timing(scale, {
      toValue: phase === 'in' ? 1 : CIRCLE_REST,
      duration: phase === 'in' ? INHALE_MS : EXHALE_MS,
      easing: Easing.inOut(Easing.sin),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [phase, reduced, scale]);

  const label = phase === 'in' ? t('sinProgram.urge.inhale') : phase === 'out' ? t('sinProgram.urge.exhale') : t('sinProgram.urge.breathDone');
  return (
    <View style={styles.pacer}>
      <Animated.View style={[styles.circle, { transform: [{ scale: reduced ? 1 : scale }] }]}>
        <Text variant="heading" tone="link" accessibilityLiveRegion="polite">
          {label}
        </Text>
      </Animated.View>
      <Text variant="small" tone="muted">
        {t('sinProgram.urge.breathCount', { n: String(Math.min(breath, breaths)), total: String(breaths) })}
      </Text>
    </View>
  );
}

/** One practical move to pick; picking it is only for the user (nothing is recorded). */
export function MoveChoices({ urge }: { urge: UrgeMoment }) {
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <View style={styles.options} accessibilityRole="radiogroup">
      {urge.move.moves.map((move) => (
        <CheckRow
          key={move.key}
          radio
          title={pick(move, 'title', locale)}
          hint={move.bodyAr ? pick(move, 'body', locale) : undefined}
          checked={selected === move.key}
          onPress={() => setSelected(move.key)}
        />
      ))}
    </View>
  );
}

/** «أجّل عشر دقائق»: one generic local notification afterwards, if the user allows notifications. */
export function DelayAction({ minutes }: { minutes: number }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const [state, setState] = useState<'idle' | 'working' | 'set' | 'denied'>('idle');
  const handleDelay = useCallback(() => {
    setState('working');
    void scheduleUrgeCheckBack(minutes, t('practice.notify.channelName')).then((ok) => setState(ok ? 'set' : 'denied'));
  }, [minutes, t]);
  return (
    <View style={styles.block}>
      {state === 'set' ? <Notice icon={Check}>{t('sinProgram.urge.delaySet', { minutes: String(minutes) })}</Notice> : null}
      {state === 'denied' ? <Notice>{t('sinProgram.urge.delayNoPermission', { minutes: String(minutes) })}</Notice> : null}
      {state === 'idle' || state === 'working' ? (
        <Button
          label={t('sinProgram.urge.delayButton', { minutes: String(minutes) })}
          icon={BellRing}
          onPress={handleDelay}
          loading={state === 'working'}
          variant="outline"
        />
      ) : null}
    </View>
  );
}

/** «ادعُ لي» to one of my circles: a preset with no words of the user's own (same one-per-day rule as every cheer). */
function AskCircle({ circle }: { circle: CircleSummary }) {
  const { t } = useTranslation();
  const send = useSendCheer(circle.id);
  const handleSend = useCallback(() => {
    send.mutate({ message: 'ask_dua' }, { onSuccess: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) });
  }, [send]);
  if (send.isSuccess) return <Notice icon={Check}>{t('sinProgram.urge.companionSent', { name: circle.name })}</Notice>;
  return (
    <View style={{ gap: space.xs }}>
      <Button label={t('sinProgram.urge.companionCircle', { name: circle.name })} onPress={handleSend} loading={send.isPending} variant="outline" />
      {send.isError ? <ErrorText>{t(circleErrorKey(send.error))}</ErrorText> : null}
    </View>
  );
}

/** A companion's prayer: «ادعُ لي» to a «رفقة» circle when signed in, or a generic line through the share sheet. */
export function CompanionActions({ urge }: { urge: UrgeMoment }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const circles = useMyCircles();
  const shareText = pick(urge.companion, 'share', locale);
  const handleShare = useCallback(() => {
    void Share.share({ message: shareText }).catch(() => undefined);
  }, [shareText]);
  return (
    <View style={styles.block}>
      {(circles.data ?? []).map((circle) => (
        <AskCircle key={circle.id} circle={circle} />
      ))}
      <Button label={t('sinProgram.urge.companionShare')} icon={Share2} onPress={handleShare} variant="outline" />
    </View>
  );
}
