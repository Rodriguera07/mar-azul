import { Ionicons } from '@expo/vector-icons';
import { DrawerActions } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { EmptyState } from '../components/EmptyState';
import { ScreenBar } from '../components/ScreenBar';
import { useAuthStore } from '../context/useAuthStore';
import { useClosedSalesRange } from '../hooks/useClosedSalesRange';
import { useResponsiveContent } from '../hooks/useResponsiveContent';
import { RootStackParamList } from '../navigation/types';
import { colors, elevationShadow, font, shape, spacing, typography } from '../theme';
import { ClosedSale } from '../types';
import { formatCurrency, formatDateLabel, formatTime } from '../utils/format';
import { describeSalePayments } from '../utils/payments';

type Props = NativeStackScreenProps<RootStackParamList, 'ClosedTablesHistory'>;

type PeriodPreset = '7d' | '30d' | '90d';

const PRESETS: { key: PeriodPreset; label: string; days: number }[] = [
  { key: '7d', label: '7 dias', days: 7 },
  { key: '30d', label: '30 dias', days: 30 },
  { key: '90d', label: '90 dias', days: 90 },
];

function subDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

// Agrupa as vendas por dia (rótulo "22/07/2026") mantendo a ordem
// cronológica decrescente já entregue pela query.
function groupByDay(sales: ClosedSale[]): { label: string; sales: ClosedSale[] }[] {
  const groups: { label: string; sales: ClosedSale[] }[] = [];
  sales.forEach((sale) => {
    const label = formatDateLabel(sale.closedAt);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.label === label) {
      lastGroup.sales.push(sale);
    } else {
      groups.push({ label, sales: [sale] });
    }
  });
  return groups;
}

export function ClosedTablesHistoryScreen({ navigation }: Props) {
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  const { contentStyle } = useResponsiveContent();
  const [preset, setPreset] = useState<PeriodPreset>('7d');

  const days = PRESETS.find((p) => p.key === preset)?.days ?? 7;
  const range = useMemo(() => ({ start: subDays(new Date(), days - 1), end: new Date() }), [days]);

  const { sales, loading } = useClosedSalesRange(orgId, range.start, range.end);
  const groups = useMemo(() => groupByDay(sales), [sales]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ScreenBar
        title="Histórico de Mesas"
        onBack={() => {
            navigation.goBack();
            navigation.dispatch(DrawerActions.openDrawer());
          }}
      />

      <View style={styles.presetRow}>
        {PRESETS.map((p) => (
          <AnimatedPressable
            key={p.key}
            style={[styles.presetChip, preset === p.key && styles.presetChipActive]}
            stateLayerColor={preset === p.key ? colors.white : colors.onSurface}
            onPress={() => setPreset(p.key)}
          >
            <Text style={[styles.presetText, preset === p.key && styles.presetTextActive]}>
              {p.label}
            </Text>
          </AnimatedPressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, contentStyle]}
        showsVerticalScrollIndicator={false}
      >
        {!loading && sales.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title="Nenhuma mesa fechada no período"
            subtitle="Tente um período maior para ver mesas anteriores."
          />
        ) : (
          groups.map((group) => (
            <View key={group.label} style={styles.group}>
              <Text style={styles.groupLabel}>{group.label}</Text>
              <View style={styles.card}>
                {group.sales.map((sale, index) => (
                  <AnimatedPressable
                    key={sale.id}
                    style={[
                      styles.row,
                      index === group.sales.length - 1 && { borderBottomWidth: 0 },
                    ]}
                    stateLayerColor={colors.onSurface}
                    onPress={() => navigation.navigate('ClosedTableDetail', { sale })}
                  >
                    <View style={styles.rowIcon}>
                      <Ionicons name="receipt-outline" size={17} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowLabel}>Mesa {sale.tableLabel}</Text>
                      <Text style={styles.rowSub}>
                        {formatTime(sale.closedAt)} · {describeSalePayments(sale.payments)}
                        {sale.closedByUserName ? ` · ${sale.closedByUserName}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.rowValue}>{formatCurrency(sale.total)}</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </AnimatedPressable>
                ))}
              </View>
            </View>
          ))
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: shape.full,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  presetRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  presetChip: {
    flex: 1,
    paddingVertical: spacing.xs,
    borderRadius: shape.full,
    overflow: 'hidden',
    backgroundColor: colors.white,
    alignItems: 'center',
    shadowColor: '#0B1B3B',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  presetChipActive: {
    backgroundColor: colors.textPrimary,
    shadowOpacity: 0,
    elevation: 0,
  },
  presetText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  presetTextActive: {
    color: colors.white,
    fontFamily: font.bold,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  group: {
    marginBottom: spacing.md,
  },
  groupLabel: {
    fontFamily: font.bold,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#0B1B3B',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: shape.full,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    ...typography.bodySm,
    fontFamily: font.bold,
    color: colors.textPrimary,
  },
  rowSub: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  rowValue: {
    ...typography.bodySm,
    fontFamily: font.semiBold,
    color: colors.emerald,
  },
});
