'use no memo';
/**
 * The three Android home-screen widgets, drawn by react-native-android-widget from plain functions (no hooks; the
 * library builds a tree from them). Colours are the app palette (src/theme/palette.ts, light theme) as hex literals,
 * because widgets render outside React Native's theme. Tapping any widget opens «ورد اليوم» in the app: ticking from
 * the widget is not offered, so the practice store is only ever written by the app itself.
 */
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { WIRD_URI, type WidgetView } from './snapshot';

const C = {
  background: '#fffcf9',
  foreground: '#263d35',
  muted: '#64746c',
  primary: '#326c59',
  gold: '#8f6514',
  border: '#dce3db',
} as const;

const open = { clickAction: 'OPEN_URI', clickActionData: { uri: WIRD_URI } } as const;
const align = (rtl: boolean) => (rtl ? 'right' : 'left') as 'right' | 'left';

export function StreakWidget({ view }: { view: WidgetView }) {
  return (
    <FlexWidget
      {...open}
      accessibilityLabel={`${view.streak.value} · ${view.streak.line}`}
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: C.background, borderRadius: 20, padding: 12, alignItems: 'center', justifyContent: 'center' }}
    >
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 6 }}>
        <TextWidget text="🔥" style={{ fontSize: 22, color: C.gold }} />
        <TextWidget text={String(view.streak.value)} style={{ fontSize: 32, fontWeight: 'bold', color: C.gold }} />
      </FlexWidget>
      <TextWidget text={view.streak.line} maxLines={2} truncate="END" style={{ fontSize: 13, color: C.muted, textAlign: 'center', marginTop: 4 }} />
    </FlexWidget>
  );
}

export function WirdWidget({ view, rtl }: { view: WidgetView; rtl: boolean }) {
  return (
    <FlexWidget
      {...open}
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: C.background, borderRadius: 20, padding: 14, flexDirection: 'column', flexGap: 4 }}
    >
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <TextWidget text={view.wird.title} style={{ fontSize: 15, fontWeight: 'bold', color: C.primary, textAlign: align(rtl) }} />
        <TextWidget text={`🔥 ${view.streak.value}`} style={{ fontSize: 14, color: C.gold }} />
      </FlexWidget>
      {view.wird.items.map((item, i) => (
        <TextWidget
          key={`${i}-${item.title}`}
          text={`${item.done ? '✓' : '○'}  ${item.title}`}
          maxLines={1}
          truncate="END"
          style={{ width: 'match_parent', fontSize: 14, color: item.done ? C.muted : C.foreground, textAlign: align(rtl) }}
        />
      ))}
      <TextWidget text={view.wird.line} maxLines={1} truncate="END" style={{ width: 'match_parent', fontSize: 12, color: C.muted, textAlign: align(rtl) }} />
    </FlexWidget>
  );
}

export function DailyTextWidget({ view, rtl }: { view: WidgetView; rtl: boolean }) {
  return (
    <FlexWidget
      {...open}
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: C.background, borderRadius: 20, padding: 14, flexDirection: 'column', justifyContent: 'center', flexGap: 6 }}
    >
      <TextWidget text={view.text.title} style={{ width: 'match_parent', fontSize: 12, color: C.primary, textAlign: align(rtl) }} />
      <TextWidget text={view.text.body} maxLines={5} truncate="END" style={{ width: 'match_parent', fontSize: 16, color: C.foreground, textAlign: align(rtl) }} />
      {view.text.attribution ? (
        <TextWidget text={view.text.attribution} maxLines={1} truncate="END" style={{ width: 'match_parent', fontSize: 11, color: C.muted, textAlign: align(rtl) }} />
      ) : null}
    </FlexWidget>
  );
}
