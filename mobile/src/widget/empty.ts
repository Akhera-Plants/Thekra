import type { WidgetSnapshot } from './snapshot';

/** Before the app has saved a snapshot (Arabic, the product language): an open-the-app state. */
export const EMPTY_SNAPSHOT: WidgetSnapshot = {
  v: 1,
  date: '',
  rtl: true,
  hasPlans: false,
  streak: 0,
  remaining: 0,
  items: [],
  source: 'mine',
  texts: [],
  occasions: [],
  labels: {
    streak: 'المداومة',
    remaining: 'بقي {n}',
    allDone: 'تمّ وردك اليوم',
    wird: 'ورد اليوم',
    openApp: 'افتح التطبيق لترى ورد اليوم',
    noHabits: 'افتح التطبيق وابدأ بغرسٍ صغير',
    dailyText: 'نص اليوم',
    noText: 'افتح التطبيق واختر مصدر نص اليوم',
    seasons: 'مواسم الخير',
    todayOccasion: 'اليوم: {title}',
    nextOccasion: 'القادم: {title}، {date}',
    months: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
  },
};
