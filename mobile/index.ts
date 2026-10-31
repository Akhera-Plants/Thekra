/**
 * App entry: expo-router's entry, plus the Android home-screen widget task (react-native-android-widget registers a
 * headless JS task that draws the widgets from the saved snapshot; see src/widget/). A no-op off Android.
 */
import 'expo-router/entry';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './src/widget/task-handler';

registerWidgetTaskHandler(widgetTaskHandler);
