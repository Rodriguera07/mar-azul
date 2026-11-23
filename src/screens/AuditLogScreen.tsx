import { Ionicons } from '@expo/vector-icons';
import { DrawerActions } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { EmptyState } from '../components/EmptyState';
import { ScreenBar } from '../components/ScreenBar';
import { useAuthStore } from '../context/useAuthStore';
import { RootStackParamList } from '../navigation/types';
import { useResponsiveContent } from '../hooks/useResponsiveContent';
import { getAuditEventMeta } from '../data/auditEvents';
import { subscribeAuditLog } from '../services/firestoreOrg';
import { colors, font, radius, spacing, typography } from '../theme';
import { AuditEventType, AuditLogEntry } from '../types';
import { formatDateLabel, formatTime } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'AuditLog'>;

const FILTERS: { key: AuditEventType | 'all' | 'password'; label: string }[] = [
  { key: 'all', label: 'Tudo' },
  { key: 'table_opened', label: 'Abriu mesa' },
  { key: 'table_renamed', label: 'Renomeou mesa' },
  { key: 'items_added', label: 'Itens' },
  { key: 'table_closed', label: 'Fechou mesa' },
  { key: 'payment_recorded', label: 'Pagamento' },
  { key: 'login', label: 'Login/Logout' },
  { key: 'password', label: 'Senha' },
];

const PAGE_SIZE = 40;

function groupByDay(entries: AuditLogEntry[]): { label: string; entries: AuditLogEntry[] }[] {
  const groups: { label: string; entries: AuditLogEntry[] }[] = [];
  entries.forEach((entry) => {
    const label = formatDateLabel(entry.timestamp);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.label === label) {
      lastGroup.entries.push(entry);
    } else {
      groups.push({ label, entries: [entry] });
    }
  });
  return groups;
}

export function AuditLogScreen({ navigation }: Props) {
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  const { contentStyle } = useResponsiveContent();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [filter, setFilter] = useState<AuditEventType | 'all' | 'password'>('all');

  useEffect(() => {
    if (!orgId) return;
    return subscribeAuditLog(orgId, pageSize, setEntries);
  }, [orgId, pageSize]);

  const filtered = useMemo(() => {
    if (filter === 'all') return entries;
    if (filter === 'login') return entries.filter((e) => e.type === 'login' || e.type === 'logout');
    if (filter === 'password') {
      return entries.filter(
        (e) => e.type === 'password_changed' || e.type === 'password_reset_requested'
      );
    }
    return entries.filter((e) => e.type === filter);
  }, [entries, filter]);

  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ScreenBar
        title="Log de Auditoria"
        onBack={() => {
            navigation.goBack();
            navigation.dispatch(DrawerActions.openDrawer());
          }}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {FILTERS.map((f) => (
          <AnimatedPressable
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text
              style={[styles.filterText, filter === f.key && styles.filterTextActive]}
              numberOfLines={1}
            >
              {f.label}
            </Text>
          </AnimatedPressable>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={[styles.content, contentStyle]}
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <EmptyState icon="document-text-outline" title="Nenhum evento registrado ainda" />
        ) : (
          groups.map((group) => (
            <View key={group.label} style={styles.group}>
              <Text style={styles.groupLabel}>{group.label}</Text>
              <View style={styles.card}>
                {group.entries.map((entry, index) => {
                  const meta = getAuditEventMeta(entry.type);
                  return (
                    <View
                      key={entry.id}
                      style={[
                        styles.row,
                        index === group.entries.length - 1 && { borderBottomWidth: 0 },
                      ]}
                    >
                      <View style={[styles.rowIcon, { backgroundColor: meta.muted }]}>
                        <Ionicons name={meta.icon} size={16} color={meta.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowLabel} numberOfLines={1}>
                          {entry.userName}
                        </Text>
                        <Text style={styles.rowSub} numberOfLines={1}>
                          {meta.label}
                          {entry.tableLabel ? ` · Mesa ${entry.tableLabel}` : ''}
                          {entry.detail ? ` · ${entry.detail}` : ''}
                        </Text>
                      </View>
                      <Text style={styles.rowTime}>{formatTime(entry.timestamp)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ))
        )}

        {entries.length >= pageSize && (
          <AnimatedPressable style={styles.loadMoreBtn} onPress={() => setPageSize((n) => n + PAGE_SIZE)}>
            <Text style={styles.loadMoreText}>Carregar mais</Text>
          </AnimatedPressable>
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
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  filterScroll: {
    flexGrow: 0,
    flexShrink: 0,
    marginTop: spacing.md,
  },
  filterRow: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  filterChip: {
    backgroundColor: colors.white,
    flexShrink: 0,
    minHeight: 36,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2B1A12',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  filterChipActive: {
    backgroundColor: colors.textPrimary,
    shadowOpacity: 0,
    elevation: 0,
  },
  filterText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.white,
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
    shadowColor: '#2B1A12',
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
    borderRadius: 16,
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
  rowTime: {
    ...typography.caption,
    fontFamily: font.semiBold,
    color: colors.textMuted,
  },
  loadMoreBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  loadMoreText: {
    ...typography.bodySm,
    color: colors.primary,
    fontFamily: font.bold,
  },
});
