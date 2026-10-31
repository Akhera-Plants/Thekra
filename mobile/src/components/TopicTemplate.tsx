/**
 * The topic template on the app (redesign §4.5), mirroring the website: «الميزان» first (1–2 texts that state the
 * weight, curated or the topic's top-ranked text, said plainly), ONE action, the texts (TopicQuoteList), «من شعب
 * الإيمان» as links, then the opposite. Data comes from the topic detail endpoints; nothing here is typed text.
 */

import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BookHeart, Feather, Sprout } from 'lucide-react-native';
import { usePracticeCatalog } from '@/lib/api/practice';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import type { MizanDto, TopicBranchDto } from '@/lib/types/api';
import { QuoteCard } from '@/components/QuoteCard';
import { space, useStyles, type Theme } from '@/theme';
import { Button, ListRow, Section, Text, TextLink } from '@/ui';

/** At most this many texts in «الميزان». */
const MIZAN_MAX = 2;

const makeStyles = (_t: Theme) => ({
  stack: { gap: space.md },
  action: { gap: space.xs, alignItems: 'flex-start' as const },
});

export function MizanBlock({ mizan }: { mizan: MizanDto | null | undefined }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const items = mizan?.items.slice(0, MIZAN_MAX) ?? [];
  if (!mizan || items.length === 0) return null;
  return (
    <Section title={t('topic.mizanTitle')}>
      <View style={styles.stack}>
        <Text variant="small" tone="muted">
          {mizan.source === 'top' ? t('topic.mizanTop') : t('topic.mizanLead')}
        </Text>
        {items.map((quote) => (
          <QuoteCard key={quote.id} quote={quote} />
        ))}
      </View>
    </Section>
  );
}

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
 * The ONE action of a good-deed page: «اجعلها عادتي» opens the add flow with this deed's catalog habit chosen (a people
 * list opens its list); «في عاداتك» when it is already a habit. Hidden when no catalog habit maps to the deed.
 */
export function DeedHabitAction({ deed }: { deed: string }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const catalog = usePracticeCatalog(locale);
  const plans = usePracticeStore((s) => s.store.plans);
  const habits = catalog.data?.habits.filter((h) => h.deed === deed) ?? [];
  const habit = habits.find((h) => !h.people && h.kind !== 'periodic') ?? habits[0];
  if (!habit) return null;
  const plan = plans.find((p) => (p.habitKey ?? p.id) === habit.key);
  return (
    <View style={styles.action}>
      {plan && !habit.people ? (
        <TextLink label={t('topic.habitAdded')} onPress={() => router.push(`/practice/plan/${plan.id}`)} />
      ) : (
        <Button
          label={t('topic.makeHabit')}
          arrow
          onPress={() =>
            habit.people
              ? router.push({ pathname: '/practice/kinship', params: { circle: habit.people } })
              : router.push({ pathname: '/practice/add', params: { habit: habit.key } })
          }
        />
      )}
      <Text variant="caption" tone="muted">
        {t('topic.makeHabitHint')}
      </Text>
    </View>
  );
}
