/**
 * Saves the widget snapshot and asks Android to redraw every placed widget (react-native-android-widget
 * `requestWidgetUpdate`). Called by the app on foreground and after each change; a no-op off Android.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { WIDGET_NAMES, WIDGET_SNAPSHOT_KEY, type WidgetSnapshot } from './snapshot';
import { renderWidgetByName } from './task-handler';

let last = '';

export async function saveWidgetSnapshot(snapshot: WidgetSnapshot): Promise<void> {
  if (Platform.OS !== 'android') return;
  const json = JSON.stringify(snapshot);
  if (json === last) return;
  last = json;
  try {
    await AsyncStorage.setItem(WIDGET_SNAPSHOT_KEY, json);
    for (const widgetName of WIDGET_NAMES) {
      await requestWidgetUpdate({ widgetName, renderWidget: () => renderWidgetByName(widgetName, snapshot) });
    }
  } catch {
    // No widget placed, or the native module is missing (a dev build without it): the next change tries again.
    last = '';
  }
}
