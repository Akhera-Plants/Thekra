'use no memo';
/**
 * The widget task (a headless JS task the widget provider starts on add, update, resize and click). It only reads
 * the snapshot the app saved and draws; it never writes the practice store. A click opens the app (OPEN_URI is handled
 * natively), so nothing is done for WIDGET_CLICK here.
 */
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { todayFrom } from '@thekra/practice-core';
import { parseWidgetSnapshot, widgetView, WIDGET_SNAPSHOT_KEY, type WidgetSnapshot } from './snapshot';
import { DailyTextWidget, StreakWidget, WirdWidget } from './widgets';
import { EMPTY_SNAPSHOT } from './empty';

export function renderWidgetByName(name: string, snapshot: WidgetSnapshot | null): React.JSX.Element {
  const data = snapshot ?? EMPTY_SNAPSHOT;
  const view = widgetView(data, todayFrom(new Date()));
  if (name === 'StreakWidget') return <StreakWidget view={view} />;
  if (name === 'WirdWidget') return <WirdWidget view={view} rtl={data.rtl} />;
  return <DailyTextWidget view={view} rtl={data.rtl} />;
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  if (props.widgetAction === 'WIDGET_DELETED' || props.widgetAction === 'WIDGET_CLICK') return;
  const snapshot = parseWidgetSnapshot(await AsyncStorage.getItem(WIDGET_SNAPSHOT_KEY));
  props.renderWidget(renderWidgetByName(props.widgetInfo.widgetName, snapshot));
}
