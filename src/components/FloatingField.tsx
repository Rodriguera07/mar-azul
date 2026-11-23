import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { colors, font, shape, spacing, typography } from '../theme';

interface Props extends Omit<TextInputProps, 'style'> {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  accessory?: React.ReactNode;
  compact?: boolean;
}

// Campo com rótulo flutuante: o rótulo fica "dentro" do campo e sobe para
// o topo ao focar ou quando há texto (padrão de apps de login atuais), em vez
// de ocupar uma linha própria acima do campo.
export function FloatingField({ label, icon, accent, accessory, compact, value, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const floated = focused || !!value;
  const anim = useRef(new Animated.Value(floated ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: floated ? 1 : 0, duration: 160, useNativeDriver: false }).start();
  }, [floated, anim]);

  const height = compact ? 56 : 62;
  const labelTop = anim.interpolate({ inputRange: [0, 1], outputRange: [height / 2 - 10, 9] });
  const labelSize = anim.interpolate({ inputRange: [0, 1], outputRange: [15, 11] });

  return (
    <View
      style={[
        styles.wrap,
        { height },
        focused && { borderColor: accent, backgroundColor: '#FFFFFF' },
      ]}
    >
      <Ionicons name={icon} size={20} color={focused ? accent : colors.textMuted} />
      <View style={styles.inner}>
        <Animated.Text
          pointerEvents="none"
          style={[
            styles.label,
            { top: labelTop, fontSize: labelSize },
            focused && { color: accent },
          ]}
        >
          {label}
        </Animated.Text>
        <TextInput
          {...rest}
          value={value}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          placeholderTextColor={colors.textMuted}
          placeholder={floated ? rest.placeholder : undefined}
          style={[styles.input, { paddingTop: 20 }, noOutline]}
        />
      </View>
      {accessory}
    </View>
  );
}

// Na web o <input> ganha um contorno preto do navegador ao focar; o anel de
// foco já é desenhado pelo contêiner.
const noOutline = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as object;

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6F3F0',
    borderRadius: shape.large + 4,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  inner: { flex: 1, height: '100%', justifyContent: 'center' },
  label: {
    position: 'absolute',
    left: 0,
    fontFamily: font.semiBold,
    color: colors.textSecondary,
  },
  input: {
    ...typography.bodyLg,
    fontFamily: font.semiBold,
    color: colors.textPrimary,
    height: '100%',
    paddingBottom: 0,
  },
});
