/**
 * The loop builder (owner round 3, item 17): a bottom sheet with one question per step and a short helper line, after
 * the add-habit stepper (progress dots, «التالي» / «تخطَّ» / «رجوع» pinned under the step). `kind: 'habit'` asks the
 * habit template (الإشارة، النية، الفعل، المكافأة، العائق، «إن… فإني…»), `kind: 'sin'` the sin template (المثير/الموقف،
 * الشعور، الرغبة، الفعل، ما يحصل بعده، البديل). The caller saves through practice-core (the plan for a habit, the
 * encrypted program for a sin). Pure checks in src/lib/practice/loops.ts.
 */

import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Trash, X } from 'lucide-react-native';
import { canLeaveStep, loopProblem, loopSteps, loopTextMax, type LoopDraft, type LoopKind } from '@/lib/practice/loops';
import { GUTTER, radius, space, useStyles, type Theme } from '@/theme';
import { Button, ErrorText, Field, IconButton, Text, ButtonPair } from '@/ui';

const makeStyles = (t: Theme) => ({
  root: { flex: 1, justifyContent: 'flex-end' as const },
  backdrop: { position: 'absolute' as const, top: 0, bottom: 0, left: 0, right: 0, backgroundColor: t.colors.overlay },
  sheet: {
    maxHeight: '92%' as const,
    backgroundColor: t.colors.card,
    borderTopStartRadius: radius.panel,
    borderTopEndRadius: radius.panel,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: t.colors.border,
  },
  bar: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm, paddingStart: GUTTER, paddingEnd: space.sm, paddingTop: space.sm },
  barTitle: { flex: 1 },
  content: { paddingHorizontal: GUTTER, paddingTop: space.sm, paddingBottom: space.lg, gap: space.lg },
  progress: { flexDirection: 'row' as const, gap: 8, alignItems: 'center' as const },
  dot: { width: 10, height: 10, borderRadius: radius.full, backgroundColor: t.colors.border },
  dotDone: { backgroundColor: t.colors.primary },
  ask: { gap: space.xs },
  input: { minHeight: 96, textAlignVertical: 'top' as const },
  footer: { paddingHorizontal: GUTTER, paddingTop: space.md, gap: space.sm, borderTopWidth: 1, borderTopColor: t.colors.border },
  footerRow: { flexDirection: 'row' as const, gap: space.sm },
  grow: { flex: 1 },
});

export interface LoopBuilderProps {
  kind: LoopKind;
  visible: boolean;
  /** The answers to start from (editing), or empty for a new loop. */
  initial?: LoopDraft;
  /** Shown under the title: the habit's name (a sin's name is never shown outside its locked page). */
  subject?: string;
  editing?: boolean;
  onClose: () => void;
  onSave: (draft: LoopDraft) => void;
  /** Editing a saved loop: «احذف الحلقة» at the foot of the sheet, confirmed (A-15). */
  onDelete?: () => void;
}

export function LoopBuilder({ kind, visible, initial, subject, editing, onClose, onSave, onDelete }: LoopBuilderProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const steps = loopSteps(kind);
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<LoopDraft>(initial ?? {});
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setIndex(0);
    setDraft(initial ?? {});
    setProblem(null);
  }, [visible, initial]);

  const step = steps[index]!;
  const value = draft[step.field] ?? '';
  const last = index === steps.length - 1;
  const base = `loops.${kind}.steps.${step.field}`;
  const canGo = canLeaveStep(kind, step, value);

  function next() {
    if (!canGo) return;
    if (!last) {
      setIndex(index + 1);
      return;
    }
    const p = loopProblem(kind, draft);
    if (p) {
      setProblem(p);
      return;
    }
    onSave(draft);
  }

  function confirmDelete() {
    if (!onDelete) return;
    Alert.alert(t('loops.deleteTitle'), t('loops.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('loops.delete'), style: 'destructive', onPress: onDelete },
    ]);
  }

  function skip() {
    setDraft((d) => ({ ...d, [step.field]: '' }));
    if (last) {
      const p = loopProblem(kind, { ...draft, [step.field]: '' });
      if (p) setProblem(p);
      else onSave({ ...draft, [step.field]: '' });
    } else setIndex(index + 1);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.md }]} accessibilityViewIsModal>
          <View style={styles.bar}>
            <View style={styles.barTitle}>
              <Text variant="heading" accessibilityRole="header" numberOfLines={1}>
                {t(editing ? `loops.${kind}.editTitle` : `loops.${kind}.newTitle`)}
              </Text>
              {subject ? (
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {subject}
                </Text>
              ) : null}
            </View>
            <IconButton icon={X} label={t('common.close')} onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View
              style={styles.progress}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={t('loops.stepOf', { n: index + 1, total: steps.length })}
            >
              {steps.map((s, i) => (
                <View key={s.field} style={[styles.dot, i <= index && styles.dotDone]} />
              ))}
              <Text variant="caption" tone="muted">
                {t('loops.stepOf', { n: index + 1, total: steps.length })}
              </Text>
            </View>
            <View style={styles.ask}>
              <Text variant="eyebrow">{t(`${base}.label`)}</Text>
              <Text variant="title" accessibilityRole="header">
                {t(`${base}.question`)}
              </Text>
              <Text variant="small" tone="muted">
                {t(`${base}.hint`)}
              </Text>
            </View>
            <Field
              key={step.field}
              value={value}
              onChangeText={(v) => {
                setDraft((d) => ({ ...d, [step.field]: v }));
                setProblem(null);
              }}
              placeholder={t(`${base}.example`)}
              accessibilityLabel={t(`${base}.question`)}
              multiline
              maxLength={loopTextMax(kind)}
              style={styles.input}
              autoComplete="off"
              importantForAutofill="no"
              autoFocus
            />
            {problem ? <ErrorText>{t(`loops.problems.${problem}`)}</ErrorText> : null}
          </ScrollView>
          <View style={styles.footer}>
            {/* «التالي» with «تخطَّ» (or «رجوع») beside it at one size (O-02); «رجوع» drops to a quiet row only when both apply. */}
            <ButtonPair
              size="lg"
              primary={{ label: last ? t('loops.save') : t('loops.next'), onPress: next, disabled: !canGo, arrow: !last }}
              secondary={
                step.optional
                  ? { label: t('loops.skip'), onPress: skip }
                  : index > 0
                    ? { label: t('loops.back'), onPress: () => setIndex(index - 1) }
                    : null
              }
            />
            {step.optional && index > 0 ? (
              <Button label={t('loops.back')} onPress={() => setIndex(index - 1)} variant="ghost" size="sm" />
            ) : null}
            {editing && onDelete ? (
              <Button label={t('loops.deleteLoop')} icon={Trash} onPress={confirmDelete} variant="destructive" size="sm" />
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
