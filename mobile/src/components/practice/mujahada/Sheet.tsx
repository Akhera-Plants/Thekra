/**
 * A bottom sheet in the kit's look (card fill, hairline, panel radius on top), with its title and «إغلاق» in one row and
 * scrolling content (and an optional footer of actions that stays in view): the tools of «لحظة مجاهدة», the limit explanation and the strategy example. The backdrop, the
 * close button and Android back close it.
 */

import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react-native';
import { GUTTER, radius, space, useStyles, type Theme } from '@/theme';
import { IconButton, Text } from '@/ui';

const makeStyles = (t: Theme) => ({
  root: { flex: 1, justifyContent: 'flex-end' as const },
  backdrop: { position: 'absolute' as const, top: 0, bottom: 0, left: 0, right: 0, backgroundColor: t.colors.overlay },
  sheet: {
    maxHeight: '94%' as const,
    backgroundColor: t.colors.card,
    borderTopStartRadius: radius.panel,
    borderTopEndRadius: radius.panel,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: t.colors.border,
  },
  bar: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm, paddingStart: GUTTER, paddingEnd: space.sm, paddingTop: space.sm },
  title: { flex: 1 },
  content: { paddingHorizontal: GUTTER, paddingTop: space.sm, gap: space.lg },
  footer: { paddingHorizontal: GUTTER, paddingTop: space.md, gap: space.sm, borderTopWidth: 1, borderTopColor: t.colors.border },
});

export function BottomSheet({
  visible,
  title,
  onClose,
  children,
  footer,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Actions kept in view under the scrolling content (a form's «احفظ»). */
  footer?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.bar}>
            <Text variant="heading" accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            <IconButton icon={X} label={t('common.close')} onPress={onClose} />
          </View>
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: footer ? space.lg : insets.bottom + space.xl }]}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
          {footer ? <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
