/**
 * App entry: expo-router's entry, plus the Android home-screen widget task (react-native-android-widget registers a
 * headless JS task that draws the widgets from the saved snapshot; see src/widget/). A no-op off Android.
 */
import 'expo-router/entry';
import { Platform } from 'react-native';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './src/widget/task-handler';

// The headless task exists only on Android (AppRegistry.registerHeadlessTask throws on web).
if (Platform.OS === 'android') registerWidgetTaskHandler(widgetTaskHandler);
