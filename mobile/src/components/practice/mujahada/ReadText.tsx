/**
 * «اقرأ الحديث»: a framed button that opens one text by its Quote id in place (the stored text only, from the API), and
 * closes it again. Nothing shows when the id is missing; a text that cannot be loaded leaves the button out.
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BookOpen, ChevronUp } from 'lucide-react-native';
import { useEvidence } from '@/lib/api/practice';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { QuoteCard } from '@/components/QuoteCard';
import { space } from '@/theme';
import { Button } from '@/ui';

export function ReadText({ id, label }: { id: string | null | undefined; label?: string }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const [open, setOpen] = useState(false);
  const evidence = useEvidence(id && open ? [id] : [], locale);
  if (!id) return null;
  const quote = evidence.data?.get(id);
  return (
    <View style={{ gap: space.md }}>
      <Button
        label={open ? t('mujahada.hideText') : label ?? t('mujahada.readHadith')}
        icon={open ? ChevronUp : BookOpen}
        onPress={() => setOpen((o) => !o)}
        variant="outline"
        compact
        loading={open && evidence.isLoading}
      />
      {open && quote ? <QuoteCard quote={quote} shareable={false} /> : null}
    </View>
  );
}
