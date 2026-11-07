/**
 * The topic template on the app (redesign §4.5): the title, the type tabs right under it (owner, 2026-11-01: every
 * text goes under the tabs), then inside the tab: ONE action, the texts (TopicQuoteList; «الميزان» is no longer shown, owner round 3), «من شعب الإيمان» as links, then the
 * opposite. Data comes from the topic detail endpoints; nothing here is typed text.
 */

import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BookHeart, Check, Feather, Leaf, Sprout } from 'lucide-react-native';
import { usePracticeCatalog } from '@/lib/api/practice';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import type { TopicBranchDto } from '@/lib/types/api';
import { space, useStyles, type Theme } from '@/theme';
import { Button, ListRow, Section, Text } from '@/ui';


const makeStyles = (_t: Theme) => ({
  stack: { gap: space.md },
});

/** «من شعب الإيمان» on a sin or good-deed page: each branch of the topic, opening its page. */
export function TopicBranchLinks({ branches }: { branches: readonly TopicBranchDto[] | undefined }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  if (!branches || branches.length === 0) return null;
  return (
    <Section title={t('topic.branchesTitle')}>
      <View>
        {branches.map((branch) => (
          <ListRow
            key={branch.number}
            icon={BookHeart}
            title={`${branch.number} · ${locale === 'en' ? branch.title || t('branches.branchFallback', { number: branch.number }) : branch.titleAr}`}
            onPress={() => router.push(`/branches/${branch.number}`)}
          />
        ))}
      </View>
    </Section>
  );
}

/** On a branch page: its good deeds and sins (ImanBranchGoodDeed / ImanBranchSin), as links. */
export function BranchRelatedLinks({
  goodDeeds,
  sins,
}: {
  goodDeeds: readonly { slug: string; name: string; nameAr: string }[];
  sins: readonly { slug: string; name: string; nameAr: string }[];
}) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  if (goodDeeds.length === 0 && sins.length === 0) return null;
  const label = (item: { name: string; nameAr: string }) => (locale === 'en' ? item.name || item.nameAr : item.nameAr);
  return (
    <Section title={t('topic.branchRelatedTitle')}>
      <View>
        {goodDeeds.map((deed) => (
          <ListRow key={`d-${deed.slug}`} icon={Sprout} title={label(deed)} onPress={() => router.push(`/good-deeds/${deed.slug}`)} />
        ))}
        {sins.map((sin) => (
          <ListRow key={`s-${sin.slug}`} icon={Feather} title={label(sin)} onPress={() => router.push(`/sins/${sin.slug}`)} />
        ))}
      </View>
    </Section>
  );
}

/**
 * The ONE action of a good-deed page, on its title line (owner round 5, F-10 a / A-07; a `sm` button): «ابدأ عادة»
 * (solid) opens the add flow with this deed's catalog habit chosen (a people list opens its list); «في عاداتك»
 * (outlined, with a check) opens the plan when it is already a habit. Hidden when no catalog habit maps to the deed.
 */
export function DeedHabitAction({ deed }: { deed: string }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const catalog = usePracticeCatalog(locale);
  const plans = usePracticeStore((s) => s.store.plans);
  const habits = catalog.data?.habits.filter((h) => h.deed === deed) ?? [];
  const habit = habits.find((h) => !h.people && h.kind !== 'periodic') ?? habits[0];
  if (!habit) return null;
  const plan = plans.find((p) => (p.habitKey ?? p.id) === habit.key);
  if (plan && !habit.people) {
    return (
      <Button label={t('topic.habitAdded')} icon={Check} variant="outline" size="sm" onPress={() => router.push(`/practice/plan/${plan.id}`)} />
    );
  }
  return (
    <Button
      label={t('topic.startHabit')}
      size="sm"
      onPress={() =>
        habit.people
          ? router.push({ pathname: '/practice/kinship', params: { circle: habit.people } })
          : router.push({ pathname: '/practice/add', params: { habit: habit.key } })
      }
    />
  );
}
