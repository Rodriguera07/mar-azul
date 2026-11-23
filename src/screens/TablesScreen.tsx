import { Ionicons } from '@expo/vector-icons';
import { DrawerActions } from '@react-navigation/native';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { BrandHeader } from '../components/BrandHeader';
import { TableCard } from '../components/TableCard';
import { getOpenTables, getTableCurrentTotal, usePosStore } from '../context/usePosStore';
import { useTick } from '../hooks/useTick';
import { useResponsiveContent, widthForColumns } from '../hooks/useResponsiveContent';
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

  const { contentStyle, tableColumns } = useResponsiveContent();
  const tableCardWidth = widthForColumns(tableColumns);
  const [filter, setFilter] = useState<Filter>('all');

  const tables = usePosStore((s) => s.tables);
  const openTables = getOpenTables(tables);
  const openTablesTotal = openTables.reduce((sum, t) => sum + getTableCurrentTotal(t), 0);
  const isAttention = (openedAt: string) =>
    (Date.now() - new Date(openedAt).getTime()) / 60000 >= ATTENTION_MINUTES;
  const attentionCount = openTables.filter((t) => isAttention(t.openedAt)).length;
  // Blocos na ordem em que as mesas foram abertas (a mais antiga primeiro).
  const ordered = [...openTables].sort((a, b) => a.openedAt.localeCompare(b.openedAt));
  const shown = filter === 'attention' ? ordered.filter((t) => isAttention(t.openedAt)) : ordered;

  return (
    <View style={styles.safeArea}>
      <BrandHeader bottomSpace={18}>
        <View style={styles.header}>
          <AnimatedPressable
            style={styles.menuButton}
            stateLayerColor={colors.white}
            accessibilityLabel="Abrir menu"
            accessibilityRole="button"
            onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          >
            <Ionicons name="menu" size={21} color={colors.white} />
          </AnimatedPressable>
          <View style={styles.titleWrap}>
            <Text style={styles.title}>Mesas</Text>
            <Text style={styles.subtitle}>
              {openTables.length} {openTables.length === 1 ? 'aberta' : 'abertas'} · {formatCurrency(openTablesTotal)}
            </Text>
          </View>
          <AnimatedPressable
            style={styles.addButton}
            stateLayerColor={dashboardPalette.brand}
            accessibilityLabel="Abrir nova mesa"
            onPress={() => navigation.navigate('OpenTable')}
          >
            <Ionicons name="add" size={24} color={dashboardPalette.brand} />
          </AnimatedPressable>
        </View>
      </BrandHeader>

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
              <Ionicons name="restaurant-outline" size={28} color={dashboardPalette.brand} />
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
          <View style={styles.grid}>
            {shown.map((table) => (
              <TableCard
                key={table.id}
                table={table}
                style={{ width: tableCardWidth }}
                onPress={() => navigation.navigate('TableDetail', { tableId: table.id })}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  menuButton: {
    width: 42,
    height: 42,
    borderRadius: shape.full,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  titleWrap: { flex: 1 },
  title: { fontFamily: font.extraBold, fontSize: 24, letterSpacing: -0.9, color: colors.white },
  subtitle: { fontFamily: font.medium, fontSize: 12.5, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: shape.full,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  scrollContent: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  filters: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 16,
    borderRadius: shape.full,
    backgroundColor: colors.white,
    overflow: 'hidden',
    shadowColor: '#2B1A12',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  chipActive: { backgroundColor: dashboardPalette.ink900 },
  chipText: { fontFamily: font.bold, fontSize: 13, color: colors.textPrimary },
  chipTextActive: { color: colors.white },
  chipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: dashboardPalette.rose },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm + 2 },
  empty: { paddingTop: 64, paddingHorizontal: 24, alignItems: 'center' },
  emptyIll: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontFamily: font.bold, fontSize: 17, color: colors.textPrimary, marginBottom: 6 },
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
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: dashboardPalette.brand,
    marginTop: 20,
    overflow: 'hidden',
  },
  emptyButtonText: { fontFamily: font.bold, fontSize: 15, color: colors.white },
});
