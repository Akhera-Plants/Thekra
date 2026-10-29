/**
 * App entry. The notification action task is defined before expo-router registers the app, so Android can run it
 * with no screen mounted («تمّ» on a reminder while the app is closed). expo-router/entry stays last, as its
 * custom entry point guide asks.
 */
import './src/lib/practice/notification-task';
import 'expo-router/entry';
