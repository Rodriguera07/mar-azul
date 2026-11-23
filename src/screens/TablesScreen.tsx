import { Ionicons } from '@expo/vector-icons';
import { DrawerActions } from '@react-navigation/native';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { TableRow } from '../components/TableRow';
import { getOpenTables, getTableCurrentTotal, usePosStore } from '../context/usePosStore';
import { useTick } from '../hooks/useTick';
import { useResponsiveContent } from '../hooks/useResponsiveContent';
import { TabScreenProps } from '../navigation/types';
import { colors, font, shape, spacing } from '../theme';
import { dashboardPalette } from '../theme/dashboardPalette';
import { formatCurrency } from '../utils/format';

type Props = TabScreenProps<'Mesas'>;

type Filter = 'all' | 'attention';

// Mesa aberta há mais de 90 min entra em "Atenção" (mesmo limite do semáforo).
const ATTENTION_MINUTES = 90;

export function TablesScreen({ navigation }: Props) {
  useTick(30000); // mantém o tempo decorrido e a cor de urgência de cada mesa atualizados

  const { contentStyle } = useResponsiveContent();
  const [filter, setFilter] = useState<Filter>('all');

  const tables = usePosStore((s) => s.tables);
  const openTables = getOpenTables(tables);
  const openTablesTotal = openTables.reduce((sum, t) => sum + getTableCurrentTotal(t), 0);
  const isAttention = (openedAt: string) =>
    (Date.now() - new Date(openedAt).getTime()) / 60000 >= ATTENTION_MINUTES;
  const attentionCount = openTables.filter((t) => isAttention(t.openedAt)).length;
  const shown = filter === 'attention' ? openTables.filter((t) => isAttention(t.openedAt)) : openTables;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <AnimatedPressable
          style={styles.menuButton}
          stateLayerColor={colors.onSurface}
          accessibilityLabel="Abrir menu"
          accessibilityRole="button"
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <Ionicons name="menu" size={20} color={colors.textPrimary} />
        </AnimatedPressable>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Mesas</Text>
          <Text style={styles.subtitle}>
            {openTables.length} {openTables.length === 1 ? 'aberta' : 'abertas'} · {formatCurrency(openTablesTotal)}
          </Text>
        </View>
        <AnimatedPressable
          style={styles.addButton}
          stateLayerColor={colors.white}
          accessibilityLabel="Abrir nova mesa"
          onPress={() => navigation.navigate('OpenTable')}
        >
          <Ionicons name="add" size={22} color={colors.white} />
        </AnimatedPressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, contentStyle]}
        showsVerticalScrollIndicator={false}
      >
        {openTables.length > 0 && (
          <View style={styles.filters}>
            <AnimatedPressable
              style={[styles.chip, filter === 'all' && styles.chipActive]}
              stateLayerColor={filter === 'all' ? colors.white : colors.onSurface}
              onPress={() => setFilter('all')}
            >
              <Text style={[styles.chipText, filter === 'all' && styles.chipTextActive]}>
                Todas · {openTables.length}
              </Text>
            </AnimatedPressable>
            <AnimatedPressable
              style={[styles.chip, filter === 'attention' && styles.chipActive]}
              stateLayerColor={filter === 'attention' ? colors.white : colors.onSurface}
              onPress={() => setFilter('attention')}
            >
              {attentionCount > 0 && <View style={styles.chipDot} />}
              <Text style={[styles.chipText, filter === 'attention' && styles.chipTextActive]}>
                Atenção · {attentionCount}
              </Text>
            </AnimatedPressable>
          </View>
        )}

        {openTables.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIll}>
              <Ionicons name="restaurant-outline" size={24} color={colors.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>Nenhuma mesa aberta</Text>
            <Text style={styles.emptyText}>
              Abra uma mesa para lançar pedidos e acompanhar o atendimento em tempo real.
            </Text>
            <AnimatedPressable
              style={styles.emptyButton}
              stateLayerColor={colors.white}
              onPress={() => navigation.navigate('OpenTable')}
            >
              <Ionicons name="add" size={18} color={colors.white} />
              <Text style={styles.emptyButtonText}>Abrir mesa</Text>
            </AnimatedPressable>
          </View>
        ) : shown.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Tudo em dia</Text>
            <Text style={styles.emptyText}>Nenhuma mesa aberta há mais de 1h30.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {shown.map((table, index) => (
              <TableRow
                key={table.id}
                table={table}
                last={index === shown.length - 1}
                onPress={() => navigation.navigate('TableDetail', { tableId: table.id })}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: 6,
    paddingBottom: spacing.sm,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: shape.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  titleWrap: { flex: 1 },
  title: { fontFamily: font.bold, fontSize: 22, letterSpacing: -0.7, color: colors.textPrimary },
  subtitle: { fontFamily: font.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 1 },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: dashboardPalette.brand,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  scrollContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  filters: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: shape.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  chipActive: { backgroundColor: dashboardPalette.ink900, borderColor: dashboardPalette.ink900 },
  chipText: { fontFamily: font.semiBold, fontSize: 13, color: colors.textPrimary },
  chipTextActive: { color: colors.white },
  chipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: dashboardPalette.rose },
  list: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  empty: { paddingTop: 72, paddingHorizontal: 24, alignItems: 'center' },
  emptyIll: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontFamily: font.semiBold, fontSize: 16, color: colors.textPrimary, marginBottom: 6 },
  emptyText: {
    fontFamily: font.regular,
    fontSize: 13.5,
    color: colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 270,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: dashboardPalette.brand,
    marginTop: 20,
    overflow: 'hidden',
  },
  emptyButtonText: { fontFamily: font.semiBold, fontSize: 14.5, color: colors.white },
});
