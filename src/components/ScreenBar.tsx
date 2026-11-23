import { Ionicons } from '@expo/vector-icons';
import React, { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, shape, spacing } from '../theme';
import { AnimatedPressable } from './AnimatedPressable';
import { BrandHeader } from './BrandHeader';

interface Props {
  title: string;
  subtitle?: string;
  // Botão "voltar" à esquerda (telas empilhadas) e/ou "fechar" à direita
  // (telas em modal).
  onBack?: () => void;
  onClose?: () => void;
  right?: ReactNode;
  bottomSpace?: number;
  // Para telas em que o número da mesa é o assunto principal.
  titleSize?: number;
  subtitleSize?: number;
}

// Cabeçalho padrão das telas internas: faixa de marca em coral com botão
// translúcido, título grande e subtítulo — a mesma linguagem do Painel.
export function ScreenBar({
  title,
  subtitle,
  onBack,
  onClose,
  right,
  bottomSpace = 20,
  titleSize,
  subtitleSize,
}: Props) {
  return (
    <BrandHeader bottomSpace={bottomSpace}>
      <View style={styles.row}>
        {onBack && (
          <AnimatedPressable
            style={styles.btn}
            stateLayerColor={colors.white}
            accessibilityLabel="Voltar"
            accessibilityRole="button"
            onPress={onBack}
          >
            <Ionicons name="chevron-back" size={22} color={colors.white} />
          </AnimatedPressable>
        )}
        <View style={styles.titleWrap}>
          <Text
            style={[styles.title, titleSize ? { fontSize: titleSize, letterSpacing: -1 } : null]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[styles.subtitle, subtitleSize ? { fontSize: subtitleSize, fontFamily: font.bold } : null]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right}
        {onClose && (
          <AnimatedPressable
            style={styles.btn}
            stateLayerColor={colors.white}
            accessibilityLabel="Fechar"
            accessibilityRole="button"
            onPress={onClose}
          >
            <Ionicons name="close" size={22} color={colors.white} />
          </AnimatedPressable>
        )}
      </View>
    </BrandHeader>
  );
}

// Pílula translúcida para ações/estados no canto direito da faixa.
export function BarPill({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}) {
  const content = (
    <>
      {icon ? <Ionicons name={icon} size={14} color={colors.white} /> : null}
      <Text style={styles.pillText}>{label}</Text>
    </>
  );
  if (!onPress) return <View style={styles.pill}>{content}</View>;
  return (
    <AnimatedPressable
      style={styles.pill}
      scaleTo={0.94}
      stateLayerColor={colors.white}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
    >
      {content}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  btn: {
    width: 42,
    height: 42,
    borderRadius: shape.full,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  titleWrap: { flex: 1, minWidth: 0 },
  title: { fontFamily: font.extraBold, fontSize: 22, letterSpacing: -0.8, color: colors.white },
  subtitle: { fontFamily: font.medium, fontSize: 12.5, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: shape.full,
    backgroundColor: 'rgba(255,255,255,0.20)',
    overflow: 'hidden',
  },
  pillText: { fontFamily: font.bold, fontSize: 12.5, color: colors.white },
});
