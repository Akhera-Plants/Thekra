'use no memo';
/**
 * The three Android home-screen widgets, drawn by react-native-android-widget from plain functions (no hooks; the
 * library builds a tree from them). Colours are the app palette (src/theme/palette.ts, light theme) as hex literals,
 * because widgets render outside React Native's theme. Tapping any widget opens «ورد اليوم» in the app: ticking from
 * the widget is not offered, so the practice store is only ever written by the app itself. The wird widget also has a
 * generic «لحظة مجاهدة» button (owner round 5, F-24 a) that opens the moment screen; it never names a sin.
 */
import React from 'react';
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import { MOMENT_URI, WIRD_URI, type WidgetView } from './snapshot';

const C = {
  background: '#fbfcfb',
  foreground: '#263d35',
  muted: '#64746c',
  primary: '#326c59',
  border: '#dce3db',
} as const;

/** The app's streak flame (lucide `Flame`, as StreakFlame draws it) in the brand green; no emoji, no gold. */
const FLAME_PATH = 'M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4';
const flameSvg = (size: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${C.primary}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${FLAME_PATH}"/></svg>`;

const open = { clickAction: 'OPEN_URI', clickActionData: { uri: WIRD_URI } } as const;
const openMoment = { clickAction: 'OPEN_URI', clickActionData: { uri: MOMENT_URI } } as const;
/** lucide `Waves`, the app's «لحظة مجاهدة» icon. */
const wavesSvg = (size: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${C.primary}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>`;
const align = (rtl: boolean) => (rtl ? 'right' : 'left') as 'right' | 'left';

export function StreakWidget({ view }: { view: WidgetView }) {
  return (
    <FlexWidget
      {...open}
      accessibilityLabel={`${view.streak.value} · ${view.streak.line}`}
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: C.background, borderRadius: 20, padding: 12, alignItems: 'center', justifyContent: 'center' }}
    >
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 6 }}>
        <SvgWidget svg={flameSvg(24)} style={{ height: 24, width: 24 }} />
        <TextWidget text={String(view.streak.value)} style={{ fontSize: 32, fontWeight: 'bold', color: C.primary }} />
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
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 4 }}>
          <SvgWidget svg={flameSvg(16)} style={{ height: 16, width: 16 }} />
          <TextWidget text={String(view.streak.value)} style={{ fontSize: 14, fontWeight: 'bold', color: C.primary }} />
        </FlexWidget>
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
      {/* Its own tap target: the moment screen, not «ورد اليوم». */}
      <FlexWidget
        {...openMoment}
        accessibilityLabel={view.wird.moment}
        style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexGap: 6, height: 36, width: 'match_parent', borderRadius: 18, borderWidth: 1, borderColor: C.border, backgroundColor: C.background }}
      >
        <SvgWidget svg={wavesSvg(16)} style={{ height: 16, width: 16 }} />
        <TextWidget text={view.wird.moment} maxLines={1} style={{ fontSize: 14, color: C.primary }} />
      </FlexWidget>
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
