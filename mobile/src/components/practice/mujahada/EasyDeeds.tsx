/**
 * «أتبِع السيئةَ الحسنة» (owner round 3, item 13): easy deeds with a great reward (catalog `mujahada.easyHighReward`,
 * good-deed topic slugs), each as a card: its name opens the deed's page; «اجعلها عادة» opens the same add-habit stepper
 * with the matching catalog habit (or the deed page when the catalog has no habit for it). Never a jump into «تخفَّف».
 */

import React from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { HandHeart, Plus } from 'lucide-react-native';
import { useGoodDeeds } from '@/lib/api/good-deeds';
import { usePracticeCatalog } from '@/lib/api/practice';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { radius, space, useStyles, useTheme, type Theme } from '@/theme';
import { Button, ForwardChevron, Icon, Skeleton, Text } from '@/ui';

const makeStyles = (t: Theme) => ({
  list: { gap: space.sm },
  card: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.md, padding: space.md, borderRadius: radius.card, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.card },
  open: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.md, minHeight: 44, minWidth: 0 },
  texts: { flex: 1, minWidth: 0 },
});

export function EasyDeeds() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const locale = useUiLocale();
  const catalog = usePracticeCatalog(locale);
  const deeds = useGoodDeeds({ limit: 100 });
  const slugs = catalog.data?.mujahada?.easyHighReward ?? [];
  const habits = catalog.data?.habits ?? [];
  if (catalog.isLoading || deeds.isLoading) {
    return (
      <View style={styles.list}>
        <Skeleton height={56} />
        <Skeleton height={56} />
      </View>
    );
  }
  if (slugs.length === 0) return null;
  return (
    <View style={styles.list}>
      {slugs.map((slug) => {
        const deed = deeds.data?.find((d) => d.slug === slug);
        if (!deed) return null;
        const name = locale === 'en' ? deed.name || deed.nameAr : deed.nameAr || deed.name;
        const habit = habits.find((h) => h.deed === slug && !h.people) ?? habits.find((h) => h.deed === slug);
        return (
          <View key={slug} style={styles.card}>
            <Pressable
              onPress={() => router.push(`/good-deeds/${slug}`)}
              accessibilityRole="link"
              android_ripple={{ color: colors.accent }}
              style={({ pressed }) => [styles.open, pressed && { opacity: 0.7 }]}
            >
              <Icon icon={HandHeart} size={22} tone="link" strokeWidth={1.4} />
              <Text variant="body" style={styles.texts} numberOfLines={2}>
                {name}
              </Text>
              <ForwardChevron size={18} tone="muted" />
            </Pressable>
            {habit ? (
              <Button
                label={t('mujahada.makeHabit')}
                icon={Plus}
                compact
                variant="outline"
                accessibilityLabel={`${t('mujahada.makeHabit')}: ${name}`}
                onPress={() => router.push({ pathname: '/practice/add', params: { habit: habit.key } })}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
