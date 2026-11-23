import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { useResponsiveContent } from '../hooks/useResponsiveContent';
import { RootStackParamList } from '../navigation/types';
import { dashboardPalette } from '../theme/dashboardPalette';
import { colors, font, elevationShadow, shape, spacing, typography } from '../theme';
import { PaymentMethod } from '../types';
import { formatCurrency, formatDateLabel, formatTime } from '../utils/format';
import { MissingTable } from '../components/MissingTable';
import { PAYMENT_LABELS, describeSalePayments } from '../utils/payments';

type Props = NativeStackScreenProps<RootStackParamList, 'EndDaySummary'>;

export function EndDaySummaryScreen({ navigation, route }: Props) {
  const summary = route.params?.summary;
  const { contentStyle } = useResponsiveContent();

  if (!summary) {
    return (
      <MissingTable
        title="Resumo indisponível"
        subtitle="O resumo do dia já foi gravado. Veja os valores em Relatórios."
        onBack={() => navigation.popToTop()}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={[styles.content, contentStyle]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="checkmark-circle" size={44} color={dashboardPalette.positive} />
        </View>
        <Text style={styles.title}>Dia encerrado</Text>
        <Text style={styles.subtitle}>
          {formatDateLabel(summary.date + 'T00:00:00')} · fechado às {formatTime(summary.closedAt)}
        </Text>

        <LinearGradient
          colors={[dashboardPalette.brandLight, dashboardPalette.brand, dashboardPalette.brandDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.revenueCard}
        >
          <Text style={styles.revenueLabel}>Faturamento total</Text>
          <Text style={styles.revenueValue}>{formatCurrency(summary.totalRevenue)}</Text>
          <Text style={styles.revenueSub}>{summary.sales.length} mesa(s) atendida(s)</Text>
        </LinearGradient>

        <Text style={styles.sectionTitle}>Formas de pagamento</Text>
        <View style={styles.paymentCard}>
          {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((method) => (
            <View key={method} style={styles.paymentRow}>
              <Ionicons name={PAYMENT_LABELS[method].icon} size={18} color={PAYMENT_LABELS[method].color} />
              <Text style={styles.paymentLabel}>{PAYMENT_LABELS[method].label}</Text>
              <Text style={styles.paymentValue}>
                {formatCurrency(summary.paymentBreakdown[method])}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Mesas do dia</Text>
        <View style={styles.salesCard}>
          {summary.sales.map((sale, index) => (
            <View
              key={sale.id}
              style={[styles.saleRow, index === summary.sales.length - 1 && { borderBottomWidth: 0 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.saleLabel}>Mesa {sale.tableLabel}</Text>
                <Text style={styles.saleSub}>
                  {describeSalePayments(sale.payments)} · {formatTime(sale.closedAt)}
                </Text>
              </View>
              <Text style={styles.saleValue}>{formatCurrency(sale.total)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, contentStyle]}>
        <Button
          label="Concluir e voltar ao painel"
          size="lg"
          variant="primary"
          onPress={() => navigation.popToTop()}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    alignItems: 'stretch',
  },
  iconWrap: {
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: font.extraBold,
    fontSize: 26,
    letterSpacing: -0.9,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodySm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  revenueCard: {
    borderRadius: 26,
    overflow: 'hidden',
    padding: spacing.lg + 4,
    alignItems: 'center',
    marginBottom: spacing.lg,
    shadowColor: dashboardPalette.brand,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  revenueLabel: {
    fontFamily: font.semiBold,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
  revenueValue: {
    fontFamily: font.extraBold,
    fontSize: 40,
    letterSpacing: -1.6,
    color: colors.white,
    marginTop: spacing.xxs,
  },
  revenueSub: {
    fontFamily: font.medium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  sectionTitle: {
    fontFamily: font.extraBold,
    fontSize: 17,
    letterSpacing: -0.4,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  paymentCard: {
    backgroundColor: colors.white,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
    shadowColor: '#0B1B3B',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  paymentLabel: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
  },
  paymentValue: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  salesCard: {
    backgroundColor: colors.white,
    overflow: 'hidden',
    shadowColor: '#0B1B3B',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  saleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  saleLabel: {
    ...typography.body,
    color: colors.textPrimary,
  },
  saleSub: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  saleValue: {
    ...typography.h3,
    color: colors.emerald,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
});
