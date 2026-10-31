/**
 * Join a circle with its invite code. `thekra://circles/join?code=…` (the shared link) opens here with the code
 * filled in; signed out, the code stays in the route while the user signs in.
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CirclesSignedOut } from '@/components/circles/CircleStates';
import { useCircleUserId, useJoinCircle } from '@/lib/api/circles';
import { circleErrorKey, cleanTypedCode } from '@/lib/circles/circle-view';
import { CIRCLE_TEXT_MAX } from '@/lib/types/circles';
import { space } from '@/theme';
import { Button, ErrorText, Field, PageHeader, Screen } from '@/ui';

export default function JoinCircleScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ code?: string }>();
  const userId = useCircleUserId();
  const join = useJoinCircle();
  const [code, setCode] = useState(() => cleanTypedCode(typeof params.code === 'string' ? params.code : ''));
  const [displayName, setDisplayName] = useState('');
  const canSubmit = code.replace(/[\s-]/g, '').length >= 10 && displayName.trim().length > 0 && !join.isPending;

  function handleJoin() {
    if (!canSubmit) return;
    join.mutate({ code, displayName: displayName.trim() }, { onSuccess: (circle) => router.replace(`/circles/${circle.id}`) });
  }

  return (
    <Screen edges={['bottom']} keyboard>
      <PageHeader title={t('circles.joinTitle')} lead={t('circles.joinLead')} />
      {userId ? (
        <View style={{ gap: space.lg }}>
          <Field
            label={t('circles.codeLabel')}
            value={code}
            onChangeText={(v) => setCode(cleanTypedCode(v))}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            textContentType="oneTimeCode"
            returnKeyType="next"
            style={{ writingDirection: 'ltr', letterSpacing: 1 }}
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
            onSubmitEditing={handleJoin}
          />
          {join.isError ? <ErrorText>{t(circleErrorKey(join.error))}</ErrorText> : null}
          <Button label={t('circles.joinButton')} onPress={handleJoin} disabled={!canSubmit} loading={join.isPending} block large />
        </View>
      ) : (
        <CirclesSignedOut />
      )}
    </Screen>
  );
}
