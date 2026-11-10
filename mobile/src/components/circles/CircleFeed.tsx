/**
 * «رسائل الصحبة» (owner round 7, D7: «مكان يظهر فيه وكأنه شات … مع القدرة على النسخ … والاحتفاظ برسالة معينة»): a
 * chat-like panel inside the صحبة page. Newest at the bottom, cut into days, each line with its sender (or on the
 * other side when it is mine), whom it went to and its time. A round shows its state and, for the others, the
 * preset encouragement (while it runs or after «لم يتم») or congratulations (after «تم»). Tapping a line opens its
 * options: copy, «احتفظ بها», and for someone else's line: report it, report the member, hide their messages.
 * «المحفوظة» shows only the kept ones. Pages of 30 («رسائل أقدم» at the top); the panel polls while it is open.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { Bookmark, BookmarkMinus, BookmarkPlus, CircleCheck, CircleSlash, Copy, EyeOff, Flag, MessageCircle, Timer, UserX } from 'lucide-react-native';
import { addDays, weekday } from '@thekra/practice-core';
import { useDisplayTime } from '@/components/practice/editors';
import { useCircleMessages, useKeepMessage, useMuteMember, useReplyToRound } from '@/lib/api/circles';
import { circleErrorKey, groupByDay, messageText, roundLine } from '@/lib/circles/circle-view';
import { nowTime, shortDate } from '@/lib/practice/format';
import { today } from '@/lib/practice/practice-store';
import { ROUND_CHEERS, ROUND_CONGRATS, type CircleDetail, type CircleMessage, type RoundReplyKey } from '@/lib/types/circles';
import { radius, space, useStyles, useTheme, type Theme } from '@/theme';
import { BottomSheet, Button, Chip, ErrorText, Icon, ListRow, Skeleton, Text, Wrap, toast } from '@/ui';
import type { ReportTarget } from './ReportSheet';

const PANEL_HEIGHT = 460;

const makeStyles = (t: Theme) => ({
  panel: {
    height: PANEL_HEIGHT,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.background,
    overflow: 'hidden' as const,
  },
  content: { padding: space.md, gap: space.sm, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, gap: space.sm, padding: space.xl },
  dayPill: {
    alignSelf: 'center' as const,
    paddingHorizontal: space.md,
    paddingVertical: 2,
    marginVertical: space.sm,
    borderRadius: radius.full,
    backgroundColor: t.colors.muted,
  },
  row: { flexDirection: 'row' as const },
  rowMine: { justifyContent: 'flex-end' as const },
  bubble: {
    maxWidth: '86%' as const,
    gap: 4,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.card,
  },
  bubbleMine: { backgroundColor: t.colors.primarySoft, borderColor: 'transparent' },
  bubblePressed: { opacity: 0.8 },
  meta: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.xs, flexWrap: 'wrap' as const },
  line: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: space.sm },
  state: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 },
  older: { alignSelf: 'center' as const, marginBottom: space.sm },
});

function useDayLabel() {
  const { t } = useTranslation();
  return (date: string) => {
    const now = today();
    if (date === now) return t('circles.feed.today');
    if (date === addDays(now, -1)) return t('circles.feed.yesterday');
    return `${t(`practice.weekdays.${weekday(date)}`)} ${shortDate(date)}`;
  };
}

/** Preset replies another member can still send to a round, by its state. */
function replyKeys(m: CircleMessage): readonly RoundReplyKey[] {
  const round = m.round;
  if (!round || round.isMine) return [];
  if (round.outcome === 'done') return ROUND_CONGRATS;
  if (round.outcome === 'not_done') return ['next_time', 'with_you'];
  if (round.closed) return [];
  return ROUND_CHEERS.filter((k) => k !== 'next_time');
}

function RoundState({ m }: { m: CircleMessage }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const round = m.round;
  if (!round) return null;
  const [icon, text, tone] =
    round.outcome === 'done'
      ? [CircleCheck, t('circles.round.done'), 'link' as const]
      : round.outcome === 'not_done'
        ? [CircleSlash, t('circles.round.notDone'), 'muted' as const]
        : round.closed || Date.parse(round.endsAt) <= Date.now()
          ? [Timer, t('circles.round.timeUp'), 'muted' as const]
          : [Timer, t('circles.round.running'), 'link' as const];
  return (
    <View style={styles.state}>
      <Icon icon={icon} size={14} tone={tone} />
      <Text variant="caption" tone={tone === 'link' ? 'link' : 'muted'}>
        {`${text} · ${t('circles.round.number', { number: round.number })}`}
      </Text>
    </View>
  );
}

function Bubble({
  m,
  circleId,
  onOpen,
}: {
  m: CircleMessage;
  circleId: string;
  onOpen: (m: CircleMessage) => void;
}) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const displayTime = useDisplayTime();
  const reply = useReplyToRound(circleId);
  const mine = m.from.isMe;
  const time = displayTime(nowTime(new Date(m.createdAt)));
  const to = m.to ? (m.to.isMe ? t('circles.feed.toYou') : t('circles.feed.toName', { name: m.to.name })) : null;
  const text = messageText(t, m);
  const keys = m.kind === 'round_start' ? replyKeys(m) : [];
  const isEnd = m.kind === 'round_end';
  return (
    <View style={[styles.row, mine && styles.rowMine]}>
      <View style={[styles.bubble, mine && styles.bubbleMine]}>
        <Pressable
          onPress={() => onOpen(m)}
          accessibilityRole="button"
          accessibilityLabel={`${mine ? t('circles.you') : m.from.name}: ${text}`}
          accessibilityHint={t('circles.feed.actions')}
          style={({ pressed }) => [{ gap: 4 }, pressed && styles.bubblePressed]}
        >
          {mine && !to ? null : (
            <Text variant="caption" weight="medium" tone="link" numberOfLines={1}>
              {[mine ? null : m.from.name, to].filter(Boolean).join(' · ')}
            </Text>
          )}
          <View style={styles.line}>
            {m.kind === 'round_start' ? <Icon icon={Timer} size={18} tone="link" /> : null}
            {isEnd ? <Icon icon={m.round?.outcome === 'done' ? CircleCheck : CircleSlash} size={18} tone={m.round?.outcome === 'done' ? 'link' : 'muted'} /> : null}
            <Text variant="body" style={{ flexShrink: 1 }} selectable>
              {text}
            </Text>
          </View>
          {m.kind === 'round_start' ? <RoundState m={m} /> : null}
          {m.kind === 'reply' && m.round ? (
            <Text variant="caption" tone="muted">
              {t('circles.round.replyOn', { kind: t(`circles.round.kinds.${m.round.kind}`) })}
            </Text>
          ) : null}
          {isEnd && m.round ? (
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {roundLine(t, m.round)}
            </Text>
          ) : null}
          <View style={styles.meta}>
            {m.saved ? <Icon icon={Bookmark} size={12} tone="link" /> : null}
            <Text variant="caption" tone="muted" accessibilityLabel={m.saved ? `${time}. ${t('circles.feed.keptA11y')}` : time}>
              {time}
            </Text>
          </View>
        </Pressable>
        {keys.length > 0 && m.round ? (
          <Wrap>
            {keys.map((key) => {
              const sent = m.round?.myReplies.includes(key) ?? false;
              return (
                <Chip
                  key={key}
                  label={t(`circles.round.replies.${key}`)}
                  selected={sent}
                  onPress={() => {
                    if (sent || reply.isPending || !m.round) return;
                    reply.mutate({ roundId: m.round.id, key }, { onSuccess: () => toast(t('circles.send.sent')) });
                  }}
                />
              );
            })}
          </Wrap>
        ) : null}
        {reply.isError ? <ErrorText>{t(circleErrorKey(reply.error))}</ErrorText> : null}
      </View>
    </View>
  );
}

function Actions({
  circle,
  message,
  onClose,
  onReport,
}: {
  circle: CircleDetail;
  message: CircleMessage | null;
  onClose: () => void;
  onReport: (target: ReportTarget) => void;
}) {
  const { t } = useTranslation();
  const keep = useKeepMessage(circle.id);
  const mute = useMuteMember(circle.id);
  if (!message) return null;
  const m = message;
  const name = m.from.name;
  // A second sheet opens only once this one has gone (iOS presents one modal at a time).
  const run = (fn: () => void, later = false) => () => {
    onClose();
    if (later) setTimeout(fn, 350);
    else fn();
  };
  const copy = () =>
    void Clipboard.setStringAsync(messageText(t, m))
      .then(() => toast(t('circles.feed.copied')))
      .catch(() => undefined);
  const toggleKeep = () =>
    keep.mutate({ messageId: m.id, kept: !m.saved }, { onSuccess: () => toast(t(m.saved ? 'circles.feed.unkept' : 'circles.feed.kept')) });
  const hide = () => mute.mutate({ memberId: m.from.memberId, muted: true }, { onSuccess: () => toast(t('circles.feed.hidden', { name })) });
  const items = [
    { key: 'copy', icon: Copy, title: t('circles.feed.copy'), onPress: copy },
    { key: 'keep', icon: m.saved ? BookmarkMinus : BookmarkPlus, title: t(m.saved ? 'circles.feed.unkeep' : 'circles.feed.keep'), onPress: toggleKeep },
    ...(m.from.isMe
      ? []
      : [
          { key: 'report', icon: Flag, title: t('circles.feed.reportMessage'), onPress: () => onReport({ kind: 'message', messageId: m.id, memberId: m.from.memberId, name }) },
          { key: 'member', icon: UserX, title: t('circles.feed.reportMember', { name }), onPress: () => onReport({ kind: 'member', memberId: m.from.memberId, name }) },
          { key: 'hide', icon: EyeOff, title: t('circles.feed.hideMember', { name }), onPress: hide },
        ]),
  ];
  return (
    <BottomSheet visible title={t('circles.feed.actions')} onClose={onClose}>
      <Text variant="small" tone="muted" numberOfLines={3}>
        {messageText(t, m)}
      </Text>
      <View>
        {items.map((item, i) => (
          <ListRow
            key={item.key}
            icon={item.icon}
            title={item.title}
            destructive={item.key === 'report' || item.key === 'member'}
            onPress={run(item.onPress, item.key === 'report' || item.key === 'member')}
            trailing={<View />}
            last={i === items.length - 1}
          />
        ))}
      </View>
    </BottomSheet>
  );
}

export function CircleFeed({
  circle,
  saved,
  onReport,
}: {
  circle: CircleDetail;
  /** «المحفوظة» only. */
  saved: boolean;
  onReport: (target: ReportTarget) => void;
}) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const dayLabel = useDayLabel();
  const feed = useCircleMessages(circle.id, saved);
  const [open, setOpen] = useState<CircleMessage | null>(null);
  const scroll = useRef<ScrollView>(null);
  const atBottom = useRef(true);
  const items = useMemo(() => feed.data?.pages.flatMap((p) => p.items) ?? [], [feed.data]);
  const days = useMemo(() => groupByDay(items), [items]);
  const newest = items[0]?.id;

  // A chat opens at its newest line and follows new ones while the reader is at the bottom.
  useEffect(() => {
    if (newest && atBottom.current) requestAnimationFrame(() => scroll.current?.scrollToEnd({ animated: false }));
  }, [newest]);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    atBottom.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 48;
  }, []);

  let body: React.ReactNode;
  if (feed.isPending) {
    body = (
      <View style={{ gap: space.md, padding: space.md }}>
        <Skeleton width="60%" height={48} />
        <View style={{ alignItems: 'flex-end' }}>
          <Skeleton width="50%" height={48} />
        </View>
        <Skeleton width="70%" height={48} />
      </View>
    );
  } else if (feed.isError) {
    body = (
      <View style={styles.empty}>
        <ErrorText>{t(circleErrorKey(feed.error))}</ErrorText>
        <Button label={t('common.retry')} variant="outline" size="sm" onPress={() => void feed.refetch()} />
      </View>
    );
  } else if (items.length === 0) {
    body = (
      <View style={styles.empty}>
        <Icon icon={saved ? Bookmark : MessageCircle} size={28} color={colors.mutedForeground} />
        <Text variant="small" tone="muted" align="center">
          {t(saved ? 'circles.feed.savedEmpty' : 'circles.feed.empty')}
        </Text>
      </View>
    );
  } else {
    body = (
      <>
        {feed.hasNextPage ? (
          <View style={styles.older}>
            <Button
              label={t('circles.feed.older')}
              variant="outline"
              size="sm"
              loading={feed.isFetchingNextPage}
              onPress={() => {
                atBottom.current = false;
                void feed.fetchNextPage();
              }}
            />
          </View>
        ) : null}
        {days.map((day) => (
          <View key={day.date} style={{ gap: space.sm }}>
            <View style={styles.dayPill}>
              <Text variant="caption" tone="muted">
                {dayLabel(day.date)}
              </Text>
            </View>
            {day.messages.map((m) => (
              <Bubble key={m.id} m={m} circleId={circle.id} onOpen={setOpen} />
            ))}
          </View>
        ))}
      </>
    );
  }

  return (
    <>
      <View style={styles.panel} accessibilityLabel={t('circles.feed.title')}>
        <ScrollView
          ref={scroll}
          nestedScrollEnabled
          contentContainerStyle={styles.content}
          onScroll={handleScroll}
          scrollEventThrottle={64}
          onContentSizeChange={() => {
            if (atBottom.current) scroll.current?.scrollToEnd({ animated: false });
          }}
        >
          {body}
        </ScrollView>
      </View>
      <Actions circle={circle} message={open} onClose={() => setOpen(null)} onReport={onReport} />
    </>
  );
}
