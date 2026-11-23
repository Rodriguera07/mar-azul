import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CATEGORY_LABELS } from '../data/menu';
import { colors, font, spacing } from '../theme';
import { formatCurrency } from '../utils/format';

export interface PriceExample {
  id: string;
  name: string;
  category: string;
  from: number;
  to: number;
}

interface PricedItem {
  id: string;
  name: string;
  category: string;
  price: number;
}

// Compara dois cardápios (antes/depois) e devolve quantos itens mudam de preço
// e alguns exemplos — de categorias diferentes, para dar uma boa noção do que
// muda antes de o admin confirmar.
export function pickPriceExamples(
  before: PricedItem[],
  after: PricedItem[],
  max = 3
): { examples: PriceExample[]; total: number } {
  const beforeById = new Map(before.map((i) => [i.id, i]));
  const diffs: PriceExample[] = [];
  for (const item of after) {
    const prev = beforeById.get(item.id);
    if (prev && prev.price !== item.price) {
      diffs.push({ id: item.id, name: item.name, category: item.category, from: prev.price, to: item.price });
    }
  }
  const examples: PriceExample[] = [];
  const usedCategories = new Set<string>();
  for (const d of diffs) {
    if (examples.length >= max) break;
    if (usedCategories.has(d.category)) continue;
    usedCategories.add(d.category);
    examples.push(d);
  }
  // Poucas categorias com mudança: completa com outros itens.
  for (const d of diffs) {
    if (examples.length >= max) break;
    if (!examples.includes(d)) examples.push(d);
  }
  return { examples, total: diffs.length };
}

// Cartão "Preços que mudam": preço atual riscado → preço novo (verde se cai,
// laranja se sobe) e o total de itens alterados.
export function PriceChangeList({
  examples,
  total,
  title = 'Preços que mudam',
}: {
  examples: PriceExample[];
  total: number;
  title?: string;
}) {
  if (examples.length === 0) return null;
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.headTitle}>{title}</Text>
        <Text style={styles.headCount}>
          {total} {total === 1 ? 'item' : 'itens'}
        </Text>
      </View>
      {examples.map((ex, i) => (
        <View key={ex.id} style={[styles.row, i > 0 && styles.rowDivider]}>
          <View style={styles.nameWrap}>
            <Text style={styles.name} numberOfLines={1}>
              {ex.name}
            </Text>
            <Text style={styles.category} numberOfLines={1}>
              {CATEGORY_LABELS[ex.category] ?? ex.category}
            </Text>
          </View>
          <Text style={styles.from}>{formatCurrency(ex.from)}</Text>
          <Ionicons name="arrow-forward" size={12} color={colors.textMuted} />
          <Text style={[styles.to, { color: ex.to > ex.from ? colors.coral : colors.emerald }]}>
            {formatCurrency(ex.to)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.md,
    borderRadius: 18,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  headTitle: {
    fontFamily: font.bold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  headCount: { fontFamily: font.semiBold, fontSize: 11, color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.outlineVariant },
  nameWrap: { flex: 1, minWidth: 0 },
  name: { fontFamily: font.semiBold, fontSize: 13.5, color: colors.textPrimary },
  category: { fontFamily: font.regular, fontSize: 11.5, color: colors.textMuted, marginTop: 1 },
  from: {
    fontFamily: font.medium,
    fontSize: 12.5,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  to: { fontFamily: font.bold, fontSize: 14 },
});
