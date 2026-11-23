import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getTableCurrentTotal } from '../context/usePosStore';
import { colors, font, spacing } from '../theme';
import { dashboardPalette } from '../theme/dashboardPalette';
import { Table } from '../types';
import { formatCurrency, formatElapsed } from '../utils/format';
import { AnimatedPressable } from './AnimatedPressable';

interface Props {
  table: Table;
  onPress: () => void;
  last?: boolean;
}

// Semáforo de atenção: mesa parada há muito tempo vira prioridade visual.
export function getTableTone(openedAt: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000));
  if (minutes >= 180) return { color: dashboardPalette.rose, label: 'Atenção' };
  if (minutes >= 90) return { color: dashboardPalette.amber, label: 'Demorando' };
  return { color: dashboardPalette.positive, label: 'No tempo' };
}

// Linha de lista (em vez de cartão): número da mesa, quem atende, itens e
// tempo, com o total à direita. Barra lateral colorida indica o semáforo.
export function TableRow({ table, onPress, last }: Props) {
  const total = getTableCurrentTotal(table);
  const itemCount = table.items.reduce((sum, i) => sum + i.quantity, 0);
  const tone = getTableTone(table.openedAt);

  return (
    <AnimatedPressable
      style={[styles.row, !last && styles.rowDivider]}
      scaleTo={0.99}
      stateLayerColor={colors.onSurface}
      onPress={onPress}
    >
      <View style={styles.badge}>
        {table.label.length <= 3 ? (
          <Text style={styles.badgeText} numberOfLines={1}>
            {table.label}
          </Text>
        ) : (
          <Ionicons name="restaurant-outline" size={20} color={colors.textPrimary} />
        )}
        <View style={[styles.toneBar, { backgroundColor: tone.color }]} />
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          Mesa {table.label}
        </Text>
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={12} color={tone.color} />
          <Text style={[styles.meta, { color: tone.color }]}>{formatElapsed(table.openedAt)}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {itemCount} {itemCount === 1 ? 'item' : 'itens'}
            {table.waiterName ? ` · ${table.waiterName}` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.right}>
        <Text style={styles.total}>{formatCurrency(total)}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontFamily: font.bold,
    fontSize: 15,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  toneBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
  },
  body: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: font.semiBold,
    fontSize: 15,
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  meta: { fontFamily: font.medium, fontSize: 12, color: colors.textSecondary, flexShrink: 1 },
  metaDot: { fontSize: 12, color: colors.textMuted },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  total: {
    fontFamily: font.semiBold,
    fontSize: 15,
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
});
