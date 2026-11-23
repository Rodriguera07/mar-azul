import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { getTableCurrentTotal } from '../context/usePosStore';
import { colors, nunitoFontFamily, shape, spacing } from '../theme';
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
function getStatusColor(minutes: number) {
  if (minutes >= 180) return dashboardPalette.rose;
  if (minutes >= 90) return dashboardPalette.amber;
  return dashboardPalette.positive;
}

function getElapsedMinutes(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

export function TableCard({ table, onPress, style }: Props) {
  const total = getTableCurrentTotal(table);
  const itemCount = table.items.reduce((sum, i) => sum + i.quantity, 0);
  const minutes = getElapsedMinutes(table.openedAt);
  const accent = getStatusColor(minutes);

  return (
    <AnimatedPressable
      style={[styles.card, { borderColor: `${accent}40` }, style]}
      stateLayerColor={accent}
      onPress={onPress}
    >
      <View style={styles.topRow}>
        <View style={[styles.numBadge, { backgroundColor: accent }]}>
          <Text style={styles.numBadgeText} numberOfLines={1}>
            {table.label}
          </Text>
        </View>
        <View style={[styles.tempoPill, { backgroundColor: `${accent}24` }]}>
          <Ionicons name="time-outline" size={11} color={accent} />
          <Text style={[styles.tempoText, { color: accent }]}>{formatElapsed(table.openedAt)}</Text>
        </View>
      </View>

      <Text style={styles.total}>{formatCurrency(total)}</Text>
      <Text style={styles.metaText}>{itemCount} {itemCount === 1 ? 'item' : 'itens'}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    backgroundColor: colors.white,
    borderRadius: shape.large,
    borderWidth: 1.5,
    overflow: 'hidden',
    padding: spacing.sm + 2,
    minHeight: 112,
    justifyContent: 'space-between',
    shadowColor: '#1C0E09',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  numBadge: {
    minWidth: 30,
    maxWidth: 90,
    height: 32,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numBadgeText: {
    fontFamily: nunitoFontFamily.extraBold,
    fontSize: 14,
    color: colors.white,
  },
  tempoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: shape.full,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  tempoText: {
    fontFamily: nunitoFontFamily.extraBold,
    fontSize: 10.5,
  },
  total: {
    fontFamily: nunitoFontFamily.extraBold,
    fontSize: 18,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  metaText: {
    fontFamily: nunitoFontFamily.semiBold,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
