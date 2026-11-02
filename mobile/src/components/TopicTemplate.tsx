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
import { nameLinkRoute } from '@/lib/api/names';
import { usePracticeCatalog } from '@/lib/api/practice';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import type { NameLinkDto, QuoteDto, TopicBranchDto } from '@/lib/types/api';
import { QuoteCard } from '@/components/QuoteCard';
import { space, useStyles, type Theme } from '@/theme';
import { Button, ListRow, Section, Text } from '@/ui';


const makeStyles = (_t: Theme) => ({
  stack: { gap: space.md },
});

/**
 * A name page's verse: the stored verse in which the name occurs, with one helper line. (Topic pages no longer show
 * «الميزان», owner round 3, item 3; the API field stays for older builds.)
 */
export function NameVerse({ quote, lead }: { quote: QuoteDto; lead?: string }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.stack}>
      {lead ? (
        <Text variant="small" tone="muted">
          {lead}
        </Text>
      ) : null}
      <QuoteCard quote={quote} />
    </View>
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

/** «التعبّد بهذا الاسم» on a name page (redesign §4.7): the topics and the action the name calls to, as links. */
export function NameWorshipLinks({ links }: { links: readonly NameLinkDto[] }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  if (links.length === 0) return null;
  const icon = { deed: Sprout, sin: Feather, action: Leaf } as const;
  const kind = { deed: t('names.kindDeed'), sin: t('names.kindSin'), action: t('names.kindAction') } as const;
  return (
    <Section title={t('names.worshipTitle')}>
      <View>
        {links.map((link) => (
          <ListRow
            key={`${link.kind}:${link.slug}`}
            icon={icon[link.kind]}
            title={locale === 'en' ? link.name || link.nameAr : link.nameAr}
            hint={kind[link.kind]}
            onPress={() => router.push(nameLinkRoute(link))}
          />
        ))}
      </View>
    </Section>
  );
}

/**
 * The ONE action of a good-deed page: «اجعلها عادتي» (solid) opens the add flow with this deed's catalog habit chosen
 * (a people list opens its list); «في عاداتك» (outlined, with a check) opens the plan when it is already a habit.
 * Hidden when no catalog habit maps to the deed.
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
      <Button label={t('topic.habitAdded')} icon={Check} variant="outline" arrow onPress={() => router.push(`/practice/plan/${plan.id}`)} />
    );
  }
  return (
    <Button
      label={t('topic.makeHabit')}
      arrow
      onPress={() =>
        habit.people
          ? router.push({ pathname: '/practice/kinship', params: { circle: habit.people } })
          : router.push({ pathname: '/practice/add', params: { habit: habit.key } })
      }
    />
  );
}
