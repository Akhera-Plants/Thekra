/**
 * Start a circle: its name, an optional shared intention («نيّتنا»), and my name inside it (never the email). On
 * success the circle opens with its invite code ready to share.
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CirclesSignedOut } from '@/components/circles/CircleStates';
import { useCircleUserId, useCreateCircle } from '@/lib/api/circles';
import { circleErrorKey } from '@/lib/circles/circle-view';
import { CIRCLE_TEXT_MAX } from '@/lib/types/circles';
import { space } from '@/theme';
import { Button, ErrorText, Field, PageHeader, Screen } from '@/ui';

export default function CreateCircleScreen() {
  const { t } = useTranslation();
  const userId = useCircleUserId();
  const create = useCreateCircle();
  const [name, setName] = useState('');
  const [intention, setIntention] = useState('');
  const [displayName, setDisplayName] = useState('');
  const canSubmit = name.trim().length > 0 && displayName.trim().length > 0 && !create.isPending;

  function handleCreate() {
    if (!canSubmit) return;
    create.mutate(
      { name: name.trim(), intention: intention.trim() || undefined, displayName: displayName.trim() },
      { onSuccess: (circle) => router.replace(`/circles/${circle.id}`) },
    );
  }

  return (
    <Screen edges={['bottom']} keyboard>
      <PageHeader title={t('circles.createTitle')} lead={t('circles.createLead')} />
      {userId ? (
        <View style={{ gap: space.lg }}>
          <Field
            label={t('circles.nameLabel')}
            hint={t('circles.nameHint')}
            value={name}
            onChangeText={setName}
            maxLength={CIRCLE_TEXT_MAX.name}
            autoComplete="off"
            textContentType="none"
            returnKeyType="next"
          />
          <Field
            label={t('circles.intentionLabel')}
            hint={t('circles.intentionHint')}
            value={intention}
            onChangeText={setIntention}
            maxLength={CIRCLE_TEXT_MAX.intention}
            autoComplete="off"
            textContentType="none"
            multiline
          />
          <Field
            label={t('circles.displayNameLabel')}
            hint={t('circles.displayNameHint')}
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={CIRCLE_TEXT_MAX.displayName}
            autoComplete="name"
            textContentType="nickname"
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
          {create.isError ? <ErrorText>{t(circleErrorKey(create.error))}</ErrorText> : null}
          <Button label={t('circles.createButton')} onPress={handleCreate} disabled={!canSubmit} loading={create.isPending} block large />
        </View>
      ) : (
        <CirclesSignedOut />
      )}
    </Screen>
  );
}
