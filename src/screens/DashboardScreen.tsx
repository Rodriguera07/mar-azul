import { Ionicons } from '@expo/vector-icons';
import { DrawerActions } from '@react-navigation/native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { ConfirmModal } from '../components/ConfirmModal';
import { PulseDot } from '../components/PulseDot';
import { SubscriptionReminderBanner } from '../components/SubscriptionReminderBanner';
import { TableRow } from '../components/TableRow';
import { useAuthStore } from '../context/useAuthStore';
import {
  getClosedTablesToday,
  getOpenTables,
  getTableCurrentTotal,
  getTodayRevenue,
  getTopSellingItems,
  usePosStore,
} from '../context/usePosStore';
import { colors, elevationShadow, font, shape, spacing } from '../theme';
import { dashboardPalette } from '../theme/dashboardPalette';
import { TabScreenProps } from '../navigation/types';
import { getDaySummary } from '../services/firestoreOrg';
import { formatDateKey, formatTime } from '../utils/format';
import { useTick } from '../hooks/useTick';
import { useResponsiveContent } from '../hooks/useResponsiveContent';

type Props = TabScreenProps<'Painel'>;

type EndDayDialog = 'blocked-open' | 'blocked-empty' | 'confirm' | null;

const TOP_ITEMS_COUNT = 3;
const SPARK_BAR_MAX_HEIGHT = 56;

const MAX_OPEN_TABLES_SHOWN = 5;

const SECONDARY_ACTIONS = [
  { key: 'pedido', icon: 'receipt-outline' as const, label: 'Novo pedido' },
  { key: 'receber', icon: 'cash-outline' as const, label: 'Receber' },
  { key: 'relatorios', icon: 'bar-chart-outline' as const, label: 'Relatórios' },
];

function getGreeting(hour: number) {
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function splitCurrencyParts(value: number): { main: string; cents: string } {
  const fixed = Math.max(0, value).toFixed(2);
  const [intPart, centsPart] = fixed.split('.');
  return { main: Number(intPart).toLocaleString('pt-BR'), cents: centsPart };
}

export function DashboardScreen({ navigation }: Props) {
  useTick(30000); // mantém o tempo decorrido das mesas atualizado

  const { contentStyle } = useResponsiveContent();
  const [endDayDialog, setEndDayDialog] = useState<EndDayDialog>(null);
  const [endingDay, setEndingDay] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  // Marca a partir de quando uma mesa aberta conta como "novidade" — só
  // avança quando o painel de notificações é fechado, para a lista não
  // sumir enquanto o usuário ainda está com o painel aberto na tela.
  const [notifSeenAt, setNotifSeenAt] = useState(() => new Date().toISOString());
  const [yesterdayRevenue, setYesterdayRevenue] = useState<number | null>(null);
  // Faturamento dos 6 dias anteriores a hoje, para o gráfico de barras da
  // semana no card "Caixa do dia" — hoje é somado à parte pois é reativo.
  const [weekHistory, setWeekHistory] = useState<{ label: string; value: number }[] | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const mesasSectionY = useRef(0);

  const userName = useAuthStore((s) => s.user?.displayName ?? null);
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin');
  const logout = useAuthStore((s) => s.logout);

  const orgId = usePosStore((s) => s.orgId);
  const tables = usePosStore((s) => s.tables);
  const closedSalesToday = usePosStore((s) => s.closedSalesToday);
  const endDay = usePosStore((s) => s.endDay);

  const openTables = getOpenTables(tables);
  const closedTables = getClosedTablesToday(tables);
  const revenue = getTodayRevenue(closedSalesToday);
  const openTablesTotal = openTables.reduce((sum, t) => sum + getTableCurrentTotal(t), 0);
  const topItems = getTopSellingItems(tables, closedSalesToday, TOP_ITEMS_COUNT);
  const topMax = topItems[0]?.quantity ?? 1;
  const topTotalQty = topItems.reduce((sum, i) => sum + i.quantity, 0) || 1;
  const menuItems = usePosStore((s) => s.menuItems);
  const imageById = useMemo(() => new Map(menuItems.map((m) => [m.id, m.image])), [menuItems]);

  useEffect(() => {
    if (!orgId) {
      setYesterdayRevenue(null);
      setWeekHistory(null);
      return;
    }
    let cancelled = false;
    const pastDays = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d;
    });
    Promise.all(pastDays.map((d) => getDaySummary(orgId, formatDateKey(d))))
      .then((summaries) => {
        if (cancelled) return;
        setYesterdayRevenue(summaries[5]?.totalRevenue ?? null);
        setWeekHistory(
          pastDays.map((d, i) => ({
            label: capitalize(d.toLocaleDateString('pt-BR', { weekday: 'narrow' })),
            value: summaries[i]?.totalRevenue ?? 0,
          }))
        );
      })
      .catch(() => {
        if (cancelled) return;
        setYesterdayRevenue(null);
        setWeekHistory(null);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const trendPct =
    yesterdayRevenue && yesterdayRevenue > 0 ? ((revenue - yesterdayRevenue) / yesterdayRevenue) * 100 : null;

  const sparkDays = weekHistory
    ? [...weekHistory, { label: capitalize(new Date().toLocaleDateString('pt-BR', { weekday: 'narrow' })), value: revenue }]
    : null;
  const sparkMax = sparkDays ? Math.max(1, ...sparkDays.map((d) => d.value)) : 1;

  const newTableNotifications = useMemo(
    () =>
      openTables
        .filter((t) => t.openedAt > notifSeenAt)
        .sort((a, b) => b.openedAt.localeCompare(a.openedAt)),
    [openTables, notifSeenAt]
  );
  const avgTicket = closedTables.length > 0 ? revenue / closedTables.length : 0;
  const { main: revenueMain, cents: revenueCents } = splitCurrencyParts(revenue);

  const today = new Date();
  const dateLabel = today.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });

  const handleEndDay = () => {
    if (!isAdmin) return;
    if (openTables.length > 0) {
      setEndDayDialog('blocked-open');
      return;
    }
    if (closedSalesToday.length === 0) {
      setEndDayDialog('blocked-empty');
      return;
    }
    setEndDayDialog('confirm');
  };

  const handleCloseNotif = () => {
    setNotifOpen(false);
    setNotifSeenAt(new Date().toISOString());
  };

  const handleConfirmEndDay = async () => {
    setEndingDay(true);
    const summary = await endDay();
    setEndingDay(false);
    setEndDayDialog(null);
    if (summary) {
      navigation.navigate('EndDaySummary', { summary });
    }
  };

  // "Novo pedido" e "Receber" dependem de escolher uma mesa primeiro — não
  // existe fluxo direto sem isso, então rolam até a seção de mesas abertas
  // (ou mandam abrir uma mesa, se não houver nenhuma).
  const handleQuickAction = (key: string) => {
    if (key === 'abrir') {
      navigation.navigate('OpenTable');
      return;
    }
    if (key === 'relatorios') {
      navigation.navigate('Relatorios');
      return;
    }
    if (openTables.length === 0) {
      navigation.navigate('OpenTable');
      return;
    }
    scrollRef.current?.scrollTo({ y: mesasSectionY.current, animated: true });
  };

  const greeting = getGreeting(today.getHours());
  const initial = (userName ?? 'G').trim().charAt(0).toUpperCase();
  const shownTables = openTables.slice(0, MAX_OPEN_TABLES_SHOWN);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={[styles.scrollContent, contentStyle]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <AnimatedPressable
            style={styles.avatar}
            stateLayerColor={colors.white}
            accessibilityLabel="Abrir menu"
            accessibilityRole="button"
            onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          >
            <Text style={styles.avatarText}>{initial}</Text>
          </AnimatedPressable>
          <View style={styles.headerTextWrap}>
            <Text style={styles.greeting} numberOfLines={1}>
              {greeting}, {userName ?? 'Gerente'}
            </Text>
            <Text style={styles.date} numberOfLines={1}>
              {capitalize(dateLabel)}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <AnimatedPressable
              style={styles.iconButton}
              stateLayerColor={colors.onSurface}
              accessibilityLabel="Notificações"
              onPress={() => setNotifOpen(true)}
            >
              <Ionicons name="notifications-outline" size={19} color={colors.textPrimary} />
              {newTableNotifications.length > 0 && <View style={styles.notifDot} />}
            </AnimatedPressable>
            <AnimatedPressable
              style={styles.iconButton}
              stateLayerColor={colors.onSurface}
              accessibilityLabel="Sair"
              onPress={logout}
            >
              <Ionicons name="log-out-outline" size={19} color={colors.textPrimary} />
            </AnimatedPressable>
          </View>
        </View>

        {isAdmin && <SubscriptionReminderBanner />}

        <View style={styles.card}>
          <View style={styles.revenueTop}>
            <Text style={styles.revenueCap}>Faturamento de hoje</Text>
            <View style={styles.statusPill}>
              <PulseDot color={dashboardPalette.positive} size={6} />
              <Text style={styles.statusPillText}>Caixa aberto</Text>
            </View>
          </View>

          <View style={styles.revenueRow}>
            <Text style={styles.revenuePrefix}>R$</Text>
            <Text style={styles.revenueMain}>{revenueMain}</Text>
            <Text style={styles.revenueCents}>,{revenueCents}</Text>
          </View>

          {trendPct !== null && (
            <View style={styles.trendRow}>
              <View
                style={[
                  styles.trendChip,
                  { backgroundColor: trendPct >= 0 ? '#E8F7F0' : '#FDECEF' },
                ]}
              >
                <Ionicons
                  name={trendPct >= 0 ? 'arrow-up' : 'arrow-down'}
                  size={11}
                  color={trendPct >= 0 ? dashboardPalette.positive : dashboardPalette.rose}
                />
                <Text
                  style={[
                    styles.trendChipText,
                    { color: trendPct >= 0 ? dashboardPalette.positive : dashboardPalette.rose },
                  ]}
                >
                  {Math.abs(trendPct).toFixed(0)}%
                </Text>
              </View>
              <Text style={styles.trendHint}>em relação a ontem</Text>
            </View>
          )}

          {sparkDays && (
            <View style={styles.sparkRow}>
              {sparkDays.map((day, index) => {
                const isToday = index === sparkDays.length - 1;
                return (
                  <View key={index} style={styles.sparkCol}>
                    <View style={styles.sparkBarTrack}>
                      <View
                        style={[
                          styles.sparkBar,
                          isToday && styles.sparkBarToday,
                          { height: Math.max(4, (day.value / sparkMax) * SPARK_BAR_MAX_HEIGHT) },
                        ]}
                      />
                    </View>
                    <Text style={[styles.sparkLabel, isToday && styles.sparkLabelToday]}>{day.label}</Text>
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.metricsRow}>
            <View style={styles.metricCol}>
              <Text style={styles.metricValue} numberOfLines={1}>
                {openTables.length}
              </Text>
              <Text style={styles.metricLabel}>Em atendimento</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricCol}>
              <Text style={styles.metricValue} numberOfLines={1}>
                {closedTables.length}
              </Text>
              <Text style={styles.metricLabel}>Fechadas</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricCol}>
              <Text style={styles.metricValue} numberOfLines={1}>
                R$ {avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </Text>
              <Text style={styles.metricLabel}>Ticket médio</Text>
            </View>
          </View>
        </View>

        <AnimatedPressable
          style={styles.primaryAction}
          stateLayerColor={colors.white}
          onPress={() => handleQuickAction('abrir')}
        >
          <Ionicons name="add" size={20} color={colors.white} />
          <Text style={styles.primaryActionText}>Abrir nova mesa</Text>
        </AnimatedPressable>

        <View style={styles.secondaryActions}>
          {SECONDARY_ACTIONS.map((action) => (
            <AnimatedPressable
              key={action.key}
              style={styles.secondaryAction}
              stateLayerColor={colors.onSurface}
              onPress={() => handleQuickAction(action.key)}
            >
              <Ionicons name={action.icon} size={17} color={colors.textPrimary} />
              <Text style={styles.secondaryActionLabel} numberOfLines={1}>
                {action.label}
              </Text>
            </AnimatedPressable>
          ))}
        </View>

        <View
          style={styles.section}
          onLayout={(e) => {
            mesasSectionY.current = e.nativeEvent.layout.y;
          }}
        >
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Mesas abertas</Text>
            {openTables.length > 0 && (
              <Pressable hitSlop={8} onPress={() => navigation.navigate('Mesas')}>
                <Text style={styles.sectionLink}>Ver todas</Text>
              </Pressable>
            )}
          </View>

          {openTables.length === 0 ? (
            <View style={[styles.card, styles.emptyCard]}>
              <View style={styles.emptyIll}>
                <Ionicons name="restaurant-outline" size={22} color={colors.textSecondary} />
              </View>
              <Text style={styles.emptyTitle}>Nenhuma mesa aberta</Text>
              <Text style={styles.emptyText}>
                Abra uma mesa para lançar pedidos e acompanhar o atendimento em tempo real.
              </Text>
            </View>
          ) : (
            <View style={[styles.card, styles.listCard]}>
              <View style={styles.openTotalRow}>
                <Text style={styles.openTotalLabel}>Valor em aberto</Text>
                <Text style={styles.openTotalValue}>
                  R$ {openTablesTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
              {shownTables.map((table, index) => (
                <TableRow
                  key={table.id}
                  table={table}
                  last={index === shownTables.length - 1}
                  onPress={() => navigation.navigate('TableDetail', { tableId: table.id })}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Mais vendidos hoje</Text>
            <Text style={styles.sectionMeta}>Top {TOP_ITEMS_COUNT}</Text>
          </View>

          {topItems.length === 0 ? (
            <View style={[styles.card, styles.emptyCard]}>
              <Text style={styles.emptyText}>Nenhum item vendido ainda hoje.</Text>
            </View>
          ) : (
            <View style={[styles.card, styles.listCard]}>
              {topItems.map((item, index) => {
                const pct = Math.max(4, Math.round((item.quantity / topMax) * 100));
                const share = Math.round((item.quantity / topTotalQty) * 100);
                const image = imageById.get(item.menuItemId);
                return (
                  <View
                    key={item.menuItemId}
                    style={[styles.sellerRow, index < topItems.length - 1 && styles.sellerDivider]}
                  >
                    {image ? (
                      <Image source={image} style={styles.sellerThumb} resizeMode="cover" />
                    ) : (
                      <View style={[styles.sellerThumb, styles.sellerThumbEmpty]}>
                        <Text style={styles.rankNumber}>{index + 1}</Text>
                      </View>
                    )}
                    <View style={styles.sellerBody}>
                      <View style={styles.sellerTop}>
                        <Text style={styles.sellerName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={styles.sellerQty}>{item.quantity} un</Text>
                      </View>
                      <View style={styles.sellerBarRow}>
                        <View style={styles.barTrack}>
                          <View style={[styles.barFill, { width: `${pct}%` }]} />
                        </View>
                        <Text style={styles.sellerShare}>{share}%</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {isAdmin && (
          <AnimatedPressable style={styles.closeDay} stateLayerColor={colors.onSurface} onPress={handleEndDay}>
            <View style={styles.closeIcon}>
              <Ionicons name="lock-closed-outline" size={17} color={dashboardPalette.rose} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.closeTitle}>Encerrar o dia</Text>
              <Text style={styles.closeSub}>Fecha o caixa e zera o painel para amanhã</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
          </AnimatedPressable>
        )}

      </ScrollView>

      <ConfirmModal
        visible={endDayDialog === 'blocked-open'}
        icon="alert-circle-outline"
        iconColor={colors.danger}
        title="Mesas ainda abertas"
        message={`Existem ${openTables.length} mesa${openTables.length === 1 ? '' : 's'} aberta${
          openTables.length === 1 ? '' : 's'
        }. Feche todas as mesas antes de encerrar o dia.`}
        confirmLabel="Entendi"
        onCancel={() => setEndDayDialog(null)}
      />

      <ConfirmModal
        visible={endDayDialog === 'blocked-empty'}
        icon="receipt-outline"
        iconColor={colors.textMuted}
        title="Nenhuma venda hoje"
        message="Não há vendas registradas para encerrar o dia."
        confirmLabel="Entendi"
        onCancel={() => setEndDayDialog(null)}
      />

      <ConfirmModal
        visible={endDayDialog === 'confirm'}
        icon="lock-closed-outline"
        iconColor={dashboardPalette.rose}
        title="Encerrar o dia"
        confirmLabel="Encerrar dia"
        destructive
        loading={endingDay}
        onConfirm={handleConfirmEndDay}
        onCancel={() => setEndDayDialog(null)}
      >
        <View style={styles.endDayRevenueBox}>
          <Text style={styles.endDayRevenueLabel}>FATURAMENTO DE HOJE</Text>
          <Text style={styles.endDayRevenueValue}>
            R$ {revenueMain},{revenueCents}
          </Text>
        </View>
        <Text style={styles.endDayConfirmSub}>
          O caixa será fechado e o painel será zerado para amanhã.
        </Text>
      </ConfirmModal>

      <Modal visible={notifOpen} transparent animationType="fade" onRequestClose={handleCloseNotif}>
        <Pressable style={styles.notifBackdrop} onPress={handleCloseNotif}>
          <Pressable style={styles.notifPanel} onPress={(e) => e.stopPropagation()}>
            <View style={styles.notifHeader}>
              <Text style={styles.notifTitle}>Notificações</Text>
              {newTableNotifications.length > 0 && (
                <View style={styles.notifHeaderBadge}>
                  <Text style={styles.notifHeaderBadgeText}>{newTableNotifications.length}</Text>
                </View>
              )}
            </View>

            {newTableNotifications.length === 0 ? (
              <View style={styles.notifEmpty}>
                <Ionicons name="checkmark-circle-outline" size={20} color={colors.textMuted} />
                <Text style={styles.notifEmptyText}>Nenhuma novidade por aqui.</Text>
              </View>
            ) : (
              newTableNotifications.map((table) => (
                <AnimatedPressable
                  key={table.id}
                  style={styles.notifRow}
                  stateLayerColor={colors.onSurface}
                  onPress={() => {
                    handleCloseNotif();
                    navigation.navigate('TableDetail', { tableId: table.id });
                  }}
                >
                  <View style={styles.notifRowIcon}>
                    <Ionicons name="restaurant-outline" size={16} color={dashboardPalette.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.notifRowTitle}>Mesa {table.label} aberta</Text>
                    <Text style={styles.notifRowSub}>
                      {formatTime(table.openedAt)}
                      {table.waiterName ? ` · ${table.waiterName}` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </AnimatedPressable>
              ))
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: 6,
    paddingBottom: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: shape.full,
    backgroundColor: dashboardPalette.ink900,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarText: { fontFamily: font.bold, fontSize: 17, color: colors.white },
  headerTextWrap: { flex: 1, minWidth: 0 },
  greeting: {
    fontFamily: font.bold,
    fontSize: 18,
    letterSpacing: -0.5,
    color: colors.textPrimary,
  },
  date: {
    fontFamily: font.medium,
    fontSize: 12.5,
    color: colors.textSecondary,
    marginTop: 1,
  },
  headerActions: { flexDirection: 'row', gap: 6 },
  iconButton: {
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
  notifDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: dashboardPalette.brand,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  notifBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'flex-end',
    paddingTop: 64,
    paddingHorizontal: spacing.md,
  },
  notifPanel: {
    width: 300,
    maxWidth: '100%',
    maxHeight: 360,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: shape.large,
    overflow: 'hidden',
    ...elevationShadow(3),
  },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  notifTitle: {
    fontFamily: font.bold,
    fontSize: 16,
    color: colors.textPrimary,
    flex: 1,
  },
  notifHeaderBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: spacing.xxs,
    backgroundColor: '#FDEBE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifHeaderBadgeText: {
    fontFamily: font.bold,
    fontSize: 12,
    color: dashboardPalette.brand,
  },
  notifEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.lg,
  },
  notifEmptyText: {
    fontFamily: font.semiBold,
    fontSize: 13,
    color: colors.textMuted,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  notifRowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FDEBE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifRowTitle: {
    fontFamily: font.bold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  notifRowSub: {
    fontFamily: font.medium,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },

  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md + 2,
  },
  listCard: { padding: 0, overflow: 'hidden' },
  revenueTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  revenueCap: { fontFamily: font.medium, fontSize: 13, color: colors.textSecondary },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: shape.full,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  statusPillText: { fontFamily: font.semiBold, fontSize: 11.5, color: colors.textPrimary },
  revenueRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 10 },
  revenuePrefix: {
    fontFamily: font.semiBold,
    fontSize: 18,
    color: colors.textSecondary,
    marginRight: 4,
  },
  revenueMain: {
    fontFamily: font.bold,
    fontSize: 40,
    letterSpacing: -1.6,
    color: colors.textPrimary,
  },
  revenueCents: { fontFamily: font.semiBold, fontSize: 20, color: colors.textSecondary },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  trendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: shape.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  trendChipText: { fontFamily: font.bold, fontSize: 12 },
  trendHint: { fontFamily: font.medium, fontSize: 12, color: colors.textSecondary },
  sparkRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: spacing.lg,
  },
  sparkCol: { flex: 1, alignItems: 'center', gap: 6 },
  sparkBarTrack: { height: SPARK_BAR_MAX_HEIGHT, justifyContent: 'flex-end', width: '100%' },
  sparkBar: { width: '100%', borderRadius: 6, backgroundColor: colors.surfaceContainerHighest },
  sparkBarToday: { backgroundColor: dashboardPalette.brand },
  sparkLabel: { fontFamily: font.medium, fontSize: 11, color: colors.textMuted },
  sparkLabelToday: { fontFamily: font.bold, color: colors.textPrimary },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  metricCol: { flex: 1, alignItems: 'flex-start', paddingLeft: spacing.xs },
  metricValue: {
    fontFamily: font.bold,
    fontSize: 20,
    letterSpacing: -0.6,
    color: colors.textPrimary,
  },
  metricLabel: { fontFamily: font.medium, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  metricDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.border },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 52,
    marginTop: spacing.sm,
    borderRadius: 16,
    backgroundColor: dashboardPalette.brand,
    overflow: 'hidden',
  },
  primaryActionText: { fontFamily: font.semiBold, fontSize: 15.5, color: colors.white, letterSpacing: -0.2 },
  secondaryActions: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    paddingHorizontal: 6,
  },
  secondaryActionLabel: { fontFamily: font.semiBold, fontSize: 12.5, color: colors.textPrimary },
  section: { marginTop: spacing.lg + 4 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs + 2,
    paddingHorizontal: 2,
  },
  sectionTitle: { fontFamily: font.bold, fontSize: 17, letterSpacing: -0.4, color: colors.textPrimary },
  sectionMeta: { fontFamily: font.medium, fontSize: 12.5, color: colors.textSecondary },
  sectionLink: { fontFamily: font.semiBold, fontSize: 13, color: dashboardPalette.brand },
  openTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.surfaceContainerLow,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  openTotalLabel: { fontFamily: font.medium, fontSize: 13, color: colors.textSecondary },
  openTotalValue: { fontFamily: font.bold, fontSize: 15, letterSpacing: -0.3, color: colors.textPrimary },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyIll: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontFamily: font.semiBold, fontSize: 15, color: colors.textPrimary, marginBottom: 4 },
  emptyText: {
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 260,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  sellerDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  sellerThumb: { width: 44, height: 44, borderRadius: 12 },
  sellerThumbEmpty: {
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNumber: { fontFamily: font.bold, fontSize: 14, color: colors.textSecondary },
  sellerBody: { flex: 1, minWidth: 0 },
  sellerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sellerName: { flex: 1, fontFamily: font.semiBold, fontSize: 14, color: colors.textPrimary, letterSpacing: -0.2 },
  sellerQty: { fontFamily: font.bold, fontSize: 13, color: colors.textPrimary },
  sellerBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 7 },
  barTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceContainerHigh,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 2, backgroundColor: dashboardPalette.brand },
  sellerShare: { fontFamily: font.medium, fontSize: 11.5, color: colors.textSecondary, minWidth: 30, textAlign: 'right' },
  closeDay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.md,
    marginTop: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  closeIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: `${dashboardPalette.rose}14`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeTitle: { fontFamily: font.semiBold, fontSize: 14, color: colors.textPrimary },
  closeSub: { fontFamily: font.regular, fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  endDayRevenueBox: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: colors.emeraldMuted,
    borderRadius: shape.medium,
    borderWidth: 1,
    borderColor: colors.emeraldGlow,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  endDayRevenueLabel: {
    fontFamily: font.bold,
    fontSize: 12,
    letterSpacing: 1.2,
    color: colors.textSecondary,
  },
  endDayRevenueValue: {
    fontFamily: font.bold,
    fontSize: 28,
    letterSpacing: -0.8,
    color: colors.emerald,
    marginTop: spacing.xxs,
  },
  endDayConfirmSub: {
    fontFamily: font.semiBold,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
