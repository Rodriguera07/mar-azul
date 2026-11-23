import { Ionicons } from '@expo/vector-icons';
import React, { ReactNode, useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, elevationShadow, font, spacing } from '../theme';
import { Button } from './Button';

export type DialogTone = 'info' | 'success' | 'warning' | 'danger';

const TONE: Record<DialogTone, { color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  info: { color: colors.primary, bg: colors.primaryMuted, icon: 'information' },
  success: { color: colors.emerald, bg: colors.emeraldMuted, icon: 'checkmark' },
  warning: { color: colors.sand, bg: colors.sandMuted, icon: 'alert' },
  danger: { color: colors.danger, bg: colors.dangerMuted, icon: 'close' },
};

interface Props {
  visible: boolean;
  tone?: DialogTone;
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  children?: ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  primaryVariant?: 'primary' | 'danger';
  // Sem rótulo secundário a janela tem um botão só (aviso/resultado).
  secondaryLabel?: string;
  onSecondary?: () => void;
  loading?: boolean;
  // Toque fora da janela / botão voltar do Android.
  onDismiss?: () => void;
}

// Janela de aviso/confirmação no visual do app (cartão branco arredondado,
// ícone em círculo na cor do tom), usada no lugar das caixas padrão do
// navegador (alert/confirm), que destoavam do resto da interface.
export function AppDialog({
  visible,
  tone = 'info',
  icon,
  title,
  message,
  children,
  primaryLabel,
  onPrimary,
  primaryVariant = 'primary',
  secondaryLabel,
  onSecondary,
  loading = false,
  onDismiss,
}: Props) {
  const appear = useRef(new Animated.Value(0)).current;
  const t = TONE[tone];

  useEffect(() => {
    if (!visible) {
      appear.setValue(0);
      return;
    }
    Animated.timing(appear, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, appear]);

  const dismiss = () => {
    if (loading) return;
    (onDismiss ?? onSecondary ?? onPrimary)();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityLabel="Fechar" />
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.card,
            {
              opacity: appear,
              transform: [
                { translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
                { scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
              ],
            },
          ]}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={[styles.iconWrap, { backgroundColor: t.bg }]}>
              <Ionicons name={icon ?? t.icon} size={28} color={t.color} />
            </View>
            <Text style={styles.title}>{title}</Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}
            {children}
            <View style={styles.actions}>
              {secondaryLabel ? (
                <Button
                  label={secondaryLabel}
                  variant="ghost"
                  onPress={onSecondary ?? dismiss}
                  disabled={loading}
                  style={styles.actionBtn}
                />
              ) : null}
              <Button
                label={primaryLabel}
                variant={primaryVariant}
                loading={loading}
                onPress={onPrimary}
                style={styles.actionBtn}
              />
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 27, 59, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '100%',
    backgroundColor: colors.white,
    borderRadius: 28,
    overflow: 'hidden',
    ...elevationShadow(3),
  },
  scroll: { flexGrow: 0 },
  content: { padding: spacing.lg, paddingTop: spacing.xl },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: font.extraBold,
    fontSize: 20,
    letterSpacing: -0.6,
    lineHeight: 25,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  message: {
    fontFamily: font.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, width: '100%' },
  actionBtn: { flex: 1 },
});
