/**
 * «لديّ دعوة» (owner round 8, Q6): the ONE place a person enters an invitation, for an account that has not turned صحبة
 * on and for one that has. The code (a shared link fills it in), then «ادخل بالدعوة»: an invite that names a صحبة joins
 * it in the same step (with the account's own name; the API asks for a name only when the account has none). Every
 * refusal is its own kind sentence (`circleErrorKey`): not recognised, expired, already used, cancelled, full. After
 * success: a toast, then the صحبة (or the list).
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { KeyRound } from 'lucide-react-native';
import { useRedeemInvite } from '@/lib/api/circles';
import { circleErrorKey, cleanTypedCode } from '@/lib/circles/circle-view';
import { ApiError } from '@/lib/types/api';
import { CIRCLE_TEXT_MAX } from '@/lib/types/circles';
import { space } from '@/theme';
import { Button, ErrorText, Field, Icon, Text, toast } from '@/ui';

export function RedeemInvite({ initialCode = '' }: { initialCode?: string }) {
  const { t } = useTranslation();
  const redeem = useRedeemInvite();
  const [code, setCode] = useState(() => cleanTypedCode(initialCode));
  const [displayName, setDisplayName] = useState('');
  /** The circle the invite also joins, once the API asked for a display name. */
  const [circleName, setCircleName] = useState<string | null>(null);
  const [askName, setAskName] = useState(false);
  const ready = code.replace(/[\s-]/g, '').length >= 6 && (!askName || displayName.trim().length > 0) && !redeem.isPending;

  function submit() {
    if (!ready) return;
    redeem.mutate(
      { code, ...(askName ? { displayName: displayName.trim() } : {}) },
      {
        onSuccess: (result) => {
          if (result.circle) {
            toast(t('circles.invites.joined', { name: result.circle.name }));
            router.replace(`/circles/${result.circle.id}`);
          } else {
            toast(t('circles.invites.redeemed'));
            router.replace('/circles');
          }
        },
        onError: (error) => {
          if (error instanceof ApiError && error.code === 'CIRCLE_DISPLAY_NAME_REQUIRED') {
            const details = error.rawDetails as { circleName?: string | null } | null;
            setCircleName(details?.circleName ?? null);
            setAskName(true);
          }
        },
      },
    );
  }

  const nameAsked = redeem.error instanceof ApiError && redeem.error.code === 'CIRCLE_DISPLAY_NAME_REQUIRED';
  // A full circle leaves the invite unused: say so (the same code reads differently for the one who creates an invite).
  const errorKey = redeem.error instanceof ApiError && redeem.error.code === 'CIRCLE_FULL' ? 'circles.errors.fullInvite' : circleErrorKey(redeem.error);
  return (
    <View style={{ gap: space.lg }}>
      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
        <Icon icon={KeyRound} size={20} tone="link" />
        <Text variant="body" style={{ flex: 1 }}>
          {t('circles.invites.redeemLead')}
        </Text>
      </View>
      <Field
        label={t('circles.codeLabel')}
        value={code}
        onChangeText={(v) => setCode(cleanTypedCode(v))}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        textContentType="oneTimeCode"
        returnKeyType={askName ? 'next' : 'done'}
        onSubmitEditing={askName ? undefined : submit}
        style={{ writingDirection: 'ltr', letterSpacing: 1 }}
      />
      {askName ? (
        <Field
          label={circleName ? t('circles.invites.nameIn', { name: circleName }) : t('circles.displayNameLabel')}
          hint={t('circles.displayNameHint')}
          value={displayName}
          onChangeText={setDisplayName}
          maxLength={CIRCLE_TEXT_MAX.displayName}
          autoComplete="name"
          textContentType="nickname"
          returnKeyType="done"
          onSubmitEditing={submit}
        />
      ) : null}
      {redeem.isError && !nameAsked ? <ErrorText>{t(errorKey)}</ErrorText> : null}
      <Button label={t('circles.invites.redeem')} onPress={submit} disabled={!ready} loading={redeem.isPending} block size="lg" />
    </View>
  );
}
