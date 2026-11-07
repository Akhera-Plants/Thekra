/**
 * The loops of one habit or one «تخفَّف» program: each as a `LoopCard` («عدّل»; delete inside the edit sheet, A-15),
 * «أضف حلقة» (several per habit, up to practice-core's limit; `single`: one loop, filled once — «حلقة المعصية» as the
 * first week's task, F-11 a), and the builder sheet. The caller writes through practice-core.
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react-native';
import type { HabitLoop, SinLoop } from '@thekra/practice-core';
import { canAddLoop, draftOf, loopsMax, type LoopDraft, type LoopKind } from '@/lib/practice/loops';
import { space, useStyles } from '@/theme';
import { Button, Text } from '@/ui';
import { LoopBuilder } from './LoopBuilder';
import { LoopCard } from './LoopCard';

const makeStyles = () => ({
  root: { gap: space.md },
});

export interface LoopsPanelProps {
  kind: LoopKind;
  loops: readonly (HabitLoop | SinLoop)[];
  /** The habit's name under the builder's title (never a sin's name). */
  subject?: string;
  onAdd: (draft: LoopDraft) => void;
  onUpdate: (id: string, draft: LoopDraft) => void;
  onRemove: (id: string) => void;
  /** One loop only: «أضف» shows while there is none (and says `addLabel`), then the card alone. */
  single?: boolean;
  /** The add button's words (default `loops.<kind>.add`). */
  addLabel?: string;
  /** Hide the «لم تكتب حلقة بعد» line (the caller explains the task itself). */
  hideEmpty?: boolean;
}

export function LoopsPanel({ kind, loops, subject, onAdd, onUpdate, onRemove, single, addLabel, hideEmpty }: LoopsPanelProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  // null: closed; 'new': a new loop; an id: editing that loop.
  const [open, setOpen] = useState<string | null>(null);
  const editing = open && open !== 'new' ? loops.find((l) => l.id === open) : undefined;
  const [initial, setInitial] = useState<LoopDraft | undefined>(undefined);
  const canAdd = canAddLoop(kind, loops.length);

  function start(id: string | 'new') {
    const loop = id === 'new' ? undefined : loops.find((l) => l.id === id);
    setInitial(loop ? draftOf(loop) : {});
    setOpen(id);
  }

  function save(draft: LoopDraft) {
    if (editing) onUpdate(editing.id, draft);
    else onAdd(draft);
    setOpen(null);
  }

  return (
    <View style={styles.root}>
      {loops.length === 0 ? (
        hideEmpty ? null : (
          <Text variant="body" tone="muted">
            {t(`loops.${kind}.empty`)}
          </Text>
        )
      ) : (
        loops.map((loop, i) => (
          <LoopCard
            key={loop.id}
            kind={kind}
            loop={loop}
            title={single && loops.length === 1 ? t('loops.yours') : t('loops.loopN', { n: i + 1 })}
            onEdit={() => start(loop.id)}
          />
        ))
      )}
      {single && loops.length > 0 ? null : (
        <Button
          label={addLabel ?? t(`loops.${kind}.add`)}
          icon={Plus}
          onPress={() => start('new')}
          variant={loops.length === 0 ? 'solid' : 'outline'}
          disabled={!canAdd}
        />
      )}
      {!canAdd && !single ? (
        <Text variant="caption" tone="muted">
          {t('loops.full', { max: loopsMax(kind) })}
        </Text>
      ) : null}
      <LoopBuilder
        kind={kind}
        visible={open !== null}
        initial={initial}
        subject={subject}
        editing={Boolean(editing)}
        onClose={() => setOpen(null)}
        onSave={save}
        onDelete={
          editing
            ? () => {
                onRemove(editing.id);
                setOpen(null);
              }
            : undefined
        }
      />
    </View>
  );
}
