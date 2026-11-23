import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Image, ImageSourcePropType, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { getTableCurrentTotal } from '../context/usePosStore';
import { DEFAULT_IMAGE_BY_ID } from '../data/menu';
import { colors, elevationShadow, font } from '../theme';
import { dashboardPalette } from '../theme/dashboardPalette';
import { Table } from '../types';
import { formatCurrency, formatElapsed } from '../utils/format';
import { AnimatedPressable } from './AnimatedPressable';

interface Props {
  table: Table;
  onPress: () => void;
  style?: ViewStyle;
}

// Semáforo de atenção: mesa parada há muito tempo vira prioridade visual.
function getTone(openedAt: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000));
  if (minutes >= 180) return dashboardPalette.rose;
  if (minutes >= 90) return dashboardPalette.amber;
  return dashboardPalette.positive;
}

// Até 3 fotos distintas dos itens da mesa, na ordem do pedido — a "capa" do
// bloco (como o card de pedido de apps de delivery).
function getCoverImages(table: Table): ImageSourcePropType[] {
  const seen = new Set<ImageSourcePropType>();
  for (const item of table.items) {
    const image = DEFAULT_IMAGE_BY_ID[item.menuItemId];
    if (image) seen.add(image);
    if (seen.size === 3) break;
  }
  return [...seen];
}

export function TableCard({ table, onPress, style }: Props) {
  const total = getTableCurrentTotal(table);
  const itemCount = table.items.reduce((sum, i) => sum + i.quantity, 0);
  const tone = getTone(table.openedAt);
  const covers = getCoverImages(table);

  return (
    <AnimatedPressable
      style={[styles.card, style]}
      scaleTo={0.97}
      stateLayerColor={colors.onSurface}
      onPress={onPress}
    >
      <View style={styles.cover}>
        {covers.length > 0 ? (
          <View style={styles.coverRow}>
            {covers.map((src, i) => (
              <Image key={i} source={src} style={styles.coverImage} resizeMode="cover" />
            ))}
          </View>
        ) : (
          <View style={styles.coverEmpty}>
            <Ionicons name="restaurant-outline" size={26} color={colors.textMuted} />
          </View>
        )}
        <LinearGradient
          colors={['rgba(0,0,0,0.38)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.30)']}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        <View style={[styles.badge, { backgroundColor: tone }]}>
          <Text style={styles.badgeText} numberOfLines={1}>
            {table.label}
          </Text>
        </View>
        <View style={styles.timePill}>
          <Ionicons name="time" size={11} color={tone} />
          <Text style={[styles.timeText, { color: tone }]}>{formatElapsed(table.openedAt)}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.total}>{formatCurrency(total)}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {itemCount} {itemCount === 1 ? 'item' : 'itens'}
          {table.waiterName ? ` · ${table.waiterName}` : ''}
        </Text>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    backgroundColor: colors.white,
    borderRadius: 22,
    overflow: 'hidden',
    ...elevationShadow(1),
  },
  cover: { height: 96, backgroundColor: colors.surfaceContainerHigh },
  coverRow: { flex: 1, flexDirection: 'row', gap: 2 },
  coverImage: { flex: 1, height: '100%' },
  coverEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 9,
    left: 9,
    minWidth: 30,
    maxWidth: 84,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: font.extraBold, fontSize: 13.5, color: colors.white, letterSpacing: -0.2 },
  timePill: {
    position: 'absolute',
    top: 9,
    right: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  timeText: { fontFamily: font.bold, fontSize: 11 },
  body: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 },
  total: { fontFamily: font.extraBold, fontSize: 18, letterSpacing: -0.6, color: colors.textPrimary },
  meta: { fontFamily: font.medium, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
