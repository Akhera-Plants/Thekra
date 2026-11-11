/**
 * Fields of the review forms (round 8): one question with the member's own words (a short field, at most 280) and, when
 * he wrote some, his answers to the daily question as one-tap chips that add themselves to the field. Enter moves to
 * the next field (the keyboard's «التالي»); on the last field it only closes the keyboard.
 */

import React, { useRef } from 'react';
import { View, type TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { REVIEW_NOTE_MAX } from '@thekra/practice-core';
import { withAnswer } from '@/lib/practice/review-draft';
import { space } from '@/theme';
import { Chip, Field, Text } from '@/ui';

/** Refs of the fields of one form, in order: `next(i)` focuses field i + 1. */
export function useFieldChain() {
  const refs = useRef<(TextInput | null)[]>([]);
  return {
    ref: (i: number) => (el: TextInput | null) => {
      refs.current[i] = el;
    },
    next: (i: number) => () => refs.current[i + 1]?.focus(),
  };
}

export function NoteField({
  label,
  value,
  onChange,
  answers = [],
  answersLabel,
  placeholder,
  max = REVIEW_NOTE_MAX,
  chain,
  index,
  last = false,
  multiline = true,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  answers?: readonly string[];
  answersLabel?: string;
  placeholder?: string;
  max?: number;
  chain: ReturnType<typeof useFieldChain>;
  index: number;
  /** The last field of the form: Enter only closes the keyboard. */
  last?: boolean;
  multiline?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: space.sm }}>
      <Field
        ref={chain.ref(index)}
        label={label}
        placeholder={placeholder ?? t('practice.heart.placeholder')}
        value={value}
        onChangeText={onChange}
        maxLength={max}
        multiline={multiline}
        // «Enter» goes to the next field; a new line is never needed in a one-line answer.
        submitBehavior={last ? 'blurAndSubmit' : 'submit'}
        returnKeyType={last ? 'done' : 'next'}
        onSubmitEditing={last ? undefined : chain.next(index)}
        hint={value.length > 0 ? `\u200E${t('practice.heart.count', { n: value.length, max })}\u200E` : undefined}
        style={multiline ? { minHeight: 72, textAlignVertical: 'top' } : undefined}
      />
      {answers.length > 0 ? (
        <View style={{ gap: space.xs }}>
          {answersLabel ? (
            <Text variant="small" tone="muted">
              {answersLabel}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {answers.slice(0, 6).map((answer) => (
              <Chip key={answer} label={answer} selected={value.includes(answer)} onPress={() => onChange(withAnswer(value, answer, max))} />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
