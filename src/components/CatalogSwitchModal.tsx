import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { catalogItems, type MenuCatalog } from '../data/menu';
import { colors, elevationShadow, font, shape, spacing } from '../theme';
import { dashboardPalette } from '../theme/dashboardPalette';
import { Button } from './Button';
import { PriceChangeList, pickPriceExamples } from './PriceChangeList';

export type CatalogSwitchStatus = 'confirm' | 'saving' | 'done' | 'error';

interface Props {
  visible: boolean;
  from: MenuCatalog;
  to: MenuCatalog;
  status: CatalogSwitchStatus;
  // Há edições no rascunho da tela de Cardápio que a troca vai descartar.
  hasUnsavedChanges: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const SHORT_LABEL: Record<MenuCatalog, string> = { novo: 'Novo', antigo: 'Antigo' };
const LONG_LABEL: Record<MenuCatalog, string> = { novo: 'cardápio novo', antigo: 'cardápio antigo' };

// Alguns itens que mudam de preço entre os dois cardápios, para o admin ter
// noção do que muda antes de confirmar.
function priceExamples(from: MenuCatalog, to: MenuCatalog) {
  return pickPriceExamples(catalogItems(from), catalogItems(to));
}

function InfoRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={14} color={colors.primary} />
      </View>
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

// Janela de troca de cardápio (novo ⇄ antigo), no visual do app — substitui as
// caixas de confirmação/alerta padrão do navegador, que destoavam do resto da
// interface. Confirmação, andamento, sucesso e erro acontecem na mesma janela.
export function CatalogSwitchModal({ visible, from, to, status, hasUnsavedChanges, onConfirm, onClose }: Props) {
  const appear = useRef(new Animated.Value(0)).current;
  const { examples, total } = useMemo(() => priceExamples(from, to), [from, to]);
  const saving = status === 'saving';

  useEffect(() => {
    if (!visible) {
      appear.setValue(0);
      return;
    }
    Animated.timing(appear, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, appear]);

  const cardMotion = {
    opacity: appear,
    transform: [
      { translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
      { scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
    ],
  };

  const close = () => {
    if (!saving) onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Fechar" />
        <Animated.View style={[styles.card, cardMotion]} accessibilityViewIsModal>
          {status === 'done' ? (
            <View style={styles.resultWrap}>
              <View style={[styles.resultIcon, { backgroundColor: colors.emeraldMuted }]}>
                <Ionicons name="checkmark" size={30} color={colors.emerald} />
              </View>
              <Text style={[styles.title, styles.center]}>{`Cardápio ${SHORT_LABEL[to].toLowerCase()} em uso`}</Text>
              <Text style={[styles.subtitle, styles.center]}>A equipe já está vendo os itens e preços deste cardápio.</Text>
              <Button label="Entendi" variant="primary" size="lg" onPress={onClose} style={styles.fullBtn} />
            </View>
          ) : status === 'error' ? (
            <View style={styles.resultWrap}>
              <View style={[styles.resultIcon, { backgroundColor: colors.dangerMuted }]}>
                <Ionicons name="cloud-offline-outline" size={28} color={colors.danger} />
              </View>
              <Text style={[styles.title, styles.center]}>Não foi possível trocar</Text>
              <Text style={[styles.subtitle, styles.center]}>
                Verifique a conexão com a internet e tente de novo. Nada foi alterado.
              </Text>
              <View style={styles.actions}>
                <Button label="Cancelar" variant="ghost" onPress={onClose} style={styles.actionBtn} />
                <Button label="Tentar de novo" variant="primary" onPress={onConfirm} style={styles.actionBtn} />
              </View>
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {/* De → Para */}
              <View style={styles.switchRow}>
                <View style={[styles.switchChip, styles.switchChipFrom]}>
                  <Text style={styles.switchChipCaption}>Atual</Text>
                  <Text style={styles.switchChipFromText} numberOfLines={1}>
                    {SHORT_LABEL[from]}
                  </Text>
                </View>
                <View style={styles.switchArrow}>
                  <Ionicons name="arrow-forward" size={16} color={colors.white} />
                </View>
                <View style={[styles.switchChip, styles.switchChipTo]}>
                  <Text style={[styles.switchChipCaption, styles.switchChipCaptionTo]}>Novo uso</Text>
                  <Text style={styles.switchChipToText} numberOfLines={1}>
                    {SHORT_LABEL[to]}
                  </Text>
                </View>
              </View>

              <Text style={styles.title}>{`Usar o ${LONG_LABEL[to]}?`}</Text>
              <Text style={styles.subtitle}>A troca vale na hora para toda a equipe.</Text>

              <PriceChangeList examples={examples} total={total} />

              <View style={styles.infoList}>
                <InfoRow icon="create-outline" text="Itens que você criou continuam no cardápio." />
                <InfoRow icon="restaurant-outline" text="Mesas abertas mantêm os preços já lançados." />
                <InfoRow icon="swap-horizontal-outline" text="Dá para voltar a qualquer momento." />
              </View>

              {hasUnsavedChanges && (
                <View style={styles.warning}>
                  <Ionicons name="alert-circle" size={16} color={colors.sand} />
                  <Text style={styles.warningText}>
                    Você tem alterações não salvas nesta tela. Elas serão descartadas.
                  </Text>
                </View>
              )}

              <View style={styles.actions}>
                <Button
                  label="Cancelar"
                  variant="ghost"
                  onPress={onClose}
                  disabled={saving}
                  style={styles.actionBtn}
                />
                <Button
                  label={saving ? 'Trocando…' : `Usar ${SHORT_LABEL[to].toLowerCase()}`}
                  variant="primary"
                  loading={saving}
                  onPress={onConfirm}
                  style={styles.actionBtn}
                />
              </View>
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 27, 59, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '100%',
    backgroundColor: colors.white,
    borderRadius: 28,
    overflow: 'hidden',
    ...elevationShadow(3),
  },
  scroll: { flexGrow: 0 },
  scrollContent: {
    padding: spacing.lg,
  },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  switchChip: {
    flex: 1,
    minWidth: 0,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
  },
  switchChipFrom: {
    backgroundColor: colors.surfaceContainer,
  },
  switchChipTo: {
    backgroundColor: dashboardPalette.brand,
  },
  switchChipCaption: {
    fontFamily: font.semiBold,
    fontSize: 10.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  switchChipCaptionTo: { color: 'rgba(255,255,255,0.75)' },
  switchChipFromText: {
    fontFamily: font.bold,
    fontSize: 16,
    letterSpacing: -0.3,
    color: colors.textSecondary,
    marginTop: 2,
  },
  switchChipToText: {
    fontFamily: font.bold,
    fontSize: 16,
    letterSpacing: -0.3,
    color: colors.white,
    marginTop: 2,
  },
  switchArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: dashboardPalette.ink900,
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    fontFamily: font.extraBold,
    fontSize: 21,
    letterSpacing: -0.6,
    lineHeight: 26,
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: font.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    marginTop: 4,
  },

  infoList: {
    marginTop: spacing.md,
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    flex: 1,
    fontFamily: font.medium,
    fontSize: 13.5,
    lineHeight: 18,
    color: colors.textSecondary,
  },

  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: shape.medium,
    backgroundColor: colors.sandMuted,
  },
  warningText: {
    flex: 1,
    fontFamily: font.medium,
    fontSize: 13,
    lineHeight: 18,
    color: colors.onTertiaryContainer,
  },

  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    width: '100%',
  },
  actionBtn: { flex: 1 },

  center: { textAlign: 'center' },
  resultWrap: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
    alignItems: 'center',
  },
  resultIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  fullBtn: {
    alignSelf: 'stretch',
    marginTop: spacing.lg,
  },
});
