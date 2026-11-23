import { Ionicons } from '@expo/vector-icons';
import { DrawerActions } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { BrandHeader } from '../components/BrandHeader';
import { BarPill } from '../components/ScreenBar';
import { Button } from '../components/Button';
import { CatalogSwitchModal, type CatalogSwitchStatus } from '../components/CatalogSwitchModal';
import { ConfirmModal } from '../components/ConfirmModal';
import {
  applyDefaultPrices,
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  MENU_CATALOG_LABELS,
  type MenuCatalog,
} from '../data/menu';
import { usePosStore } from '../context/usePosStore';
import { useResponsiveContent } from '../hooks/useResponsiveContent';
import { TabScreenProps } from '../navigation/types';
import { dashboardPalette } from '../theme/dashboardPalette';
import { colors, elevationShadow, font, shape, spacing, typography } from '../theme';
import { MenuCategory, MenuItem } from '../types';
import { confirmAlert, showAlert } from '../utils/alert';
import { generateId } from '../utils/id';

type Props = TabScreenProps<'Produtos'>;
type CategoryFilter = MenuCategory | 'all';

const CATEGORIES: MenuCategory[] = ['bebidas', 'drinks', 'doses', 'porcoes', 'pasteis'];
const FILTERS: CategoryFilter[] = ['all', ...CATEGORIES];
const CATALOGS: { key: MenuCatalog; label: string; hint: string }[] = [
  { key: 'novo', label: 'Novo', hint: 'Tabela atual' },
  { key: 'antigo', label: 'Antigo', hint: 'Tabela anterior' },
];

function stripImage(item: MenuItem) {
  const { image, ...rest } = item;
  return rest;
}

// Memoizada pra não re-renderizar TODAS as linhas do cardápio a cada tecla
// digitada em uma delas — sem isso, editar o nome/preço de um item ficava
// visivelmente travado em cardápios com muitos itens.
const MenuItemRow = React.memo(function MenuItemRow({
  item,
  onUpdate,
  onRemove,
}: {
  item: MenuItem;
  onUpdate: (id: string, patch: Partial<MenuItem>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <View style={styles.itemRow}>
      {item.image ? (
        <Image source={item.image} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty]}>
          <Ionicons name="fast-food-outline" size={18} color={colors.textMuted} />
        </View>
      )}
      <TextInput
        value={item.name}
        onChangeText={(v) => onUpdate(item.id, { name: v })}
        placeholder="Nome do item"
        placeholderTextColor={colors.textMuted}
        style={styles.nameInput}
      />
      <View style={styles.priceWrap}>
        <Text style={styles.priceCurrency}>R$</Text>
        <TextInput
          value={item.price ? String(item.price) : ''}
          onChangeText={(v) => onUpdate(item.id, { price: Number(v.replace(',', '.')) || 0 })}
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          style={styles.priceInput}
        />
      </View>
      <AnimatedPressable
        onPress={() => onRemove(item.id)}
        style={styles.removeBtn}
        stateLayerColor={colors.danger}
        accessibilityLabel={`Remover ${item.name || 'item'}`}
      >
        <Ionicons name="trash-outline" size={16} color={colors.danger} />
      </AnimatedPressable>
    </View>
  );
});

export function MenuManagementScreen({ navigation }: Props) {
  const menuItems = usePosStore((s) => s.menuItems);
  const saveMenuItems = usePosStore((s) => s.saveMenuItems);
  const menuCatalog = usePosStore((s) => s.menuCatalog);
  const selectMenuCatalog = usePosStore((s) => s.selectMenuCatalog);
  // Troca de cardápio em andamento: para qual cardápio e em que etapa está
  // (confirmação, gravando, concluída ou com erro).
  const [catalogSwitch, setCatalogSwitch] = useState<{
    from: MenuCatalog;
    to: MenuCatalog;
    status: CatalogSwitchStatus;
  } | null>(null);
  const switchingCatalog = catalogSwitch?.status === 'saving' ? catalogSwitch.to : null;
  const { contentStyle } = useResponsiveContent();

  const [draft, setDraft] = useState<MenuItem[]>(menuItems);
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>('all');
  const [saving, setSaving] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [hasEdited, setHasEdited] = useState(false);

  // `menuItems` começa como o catálogo padrão local e só vira o cardápio real
  // da organização quando o listener do Firestore resolve, o que acontece
  // de forma assíncrona depois do primeiro render. Sem isso, quem abre a
  // tela antes desse carregamento terminar edita o catálogo padrão sem
  // perceber, e "Salvar" sobrescreve o cardápio real com os itens genéricos.
  // Só resincroniza enquanto o admin não começou a editar, pra não descartar
  // uma edição em andamento.
  useEffect(() => {
    if (!hasEdited) setDraft(menuItems);
  }, [menuItems, hasEdited]);

  // `hasEdited` já é ligado exatamente nos mesmos pontos em que `draft`
  // diverge de `menuItems` (toda edição/adição/remoção) e desligado após
  // salvar — reflete "tem alteração não salva" sem precisar serializar o
  // cardápio inteiro em JSON a cada tecla digitada (ver useMemo removido).
  const isDirty = hasEdited;

  const visibleCategories = activeFilter === 'all' ? CATEGORIES : [activeFilter];

  const updateItem = useCallback((id: string, patch: Partial<MenuItem>) => {
    setHasEdited(true);
    setDraft((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  const handleAddItem = (category: MenuCategory) => {
    setHasEdited(true);
    const id = generateId('menu');
    setDraft((prev) => [...prev, { id, category, name: '', price: 0 }]);
  };

  const handleConfirmRemove = () => {
    if (!removeTarget) return;
    setHasEdited(true);
    setDraft((prev) => prev.filter((i) => i.id !== removeTarget));
    setRemoveTarget(null);
  };

  // Troca o cardápio da casa (novo/antigo). Grava na hora para toda a equipe —
  // os itens padrão passam a ser os do cardápio escolhido e os que o admin
  // criou continuam. Alterações ainda não salvas no rascunho são descartadas.
  // Toda a conversa (confirmar, andamento, sucesso/erro) acontece na janela
  // CatalogSwitchModal, no visual do app.
  const handleSelectCatalog = (catalog: MenuCatalog) => {
    if (catalog === menuCatalog || catalogSwitch) return;
    setCatalogSwitch({ from: menuCatalog, to: catalog, status: 'confirm' });
  };

  const handleConfirmCatalog = async () => {
    if (!catalogSwitch || catalogSwitch.status === 'saving') return;
    const target = catalogSwitch.to;
    setCatalogSwitch({ ...catalogSwitch, status: 'saving' });
    const saved = await selectMenuCatalog(target);
    if (saved) {
      setHasEdited(false);
      setDraft(usePosStore.getState().menuItems);
    }
    setCatalogSwitch((prev) => (prev ? { ...prev, status: saved ? 'done' : 'error' } : prev));
  };

  const handleCloseCatalogModal = () => {
    setCatalogSwitch((prev) => (prev?.status === 'saving' ? prev : null));
  };

  // Atualiza o rascunho com a tabela de preços do cardápio em uso — nada é
  // gravado até o admin tocar em "Salvar Cardápio".
  const handleApplyDefaultPrices = async () => {
    const label = MENU_CATALOG_LABELS[menuCatalog].toLowerCase();
    const ok = await confirmAlert(
      'Restaurar preços?',
      `Volta nome, descrição e preço dos itens padrão para os do ${label} e adiciona os que faltam. Itens que você criou não mudam. Depois, toque em "Salvar Cardápio" para valer para a equipe.`,
      'Restaurar'
    );
    if (!ok) return;
    const result = applyDefaultPrices(draft, menuCatalog);
    if (result.changed === 0 && result.added === 0 && result.removed === 0) {
      showAlert('Tudo em dia', `O cardápio já está com os preços do ${label}.`);
      return;
    }
    setHasEdited(true);
    setDraft(result.items);
    showAlert(
      'Preços restaurados',
      `${result.changed} item(ns) atualizado(s) e ${result.added} adicionado(s). Toque em "Salvar Cardápio" para confirmar.`
    );
  };

  const handleBack = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  const handleGoBackPress = async () => {
    if (!isDirty) {
      handleBack();
      return;
    }
    const discard = await confirmAlert(
      'Descartar alterações?',
      'Você tem mudanças no cardápio que ainda não foram salvas.',
      'Descartar'
    );
    if (discard) handleBack();
  };

  const handleSave = async () => {
    const invalid = draft.find((i) => !i.name.trim() || i.price <= 0);
    if (invalid) {
      showAlert(
        'Revise o cardápio',
        'Todo item precisa de um nome e um valor maior que zero antes de salvar.'
      );
      return;
    }
    setSaving(true);
    const ok = await saveMenuItems(draft.map(stripImage));
    setSaving(false);
    if (ok) {
      setHasEdited(false);
      showAlert('Cardápio salvo', 'As alterações já estão disponíveis para toda a equipe.');
    } else {
      showAlert('Erro', 'Não foi possível salvar o cardápio. Verifique sua conexão e tente novamente.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <BrandHeader bottomSpace={18}>
        <View style={styles.header}>
          <AnimatedPressable
            onPress={handleGoBackPress}
            style={styles.backBtn}
            stateLayerColor={colors.white}
            accessibilityLabel="Abrir menu"
          >
            <Ionicons name="menu" size={21} color={colors.white} />
          </AnimatedPressable>
          <View style={styles.titleWrap}>
            <Text style={styles.title}>Cardápio</Text>
            <Text style={styles.subtitle}>
              {draft.length} {draft.length === 1 ? 'item' : 'itens'} · {isDirty ? 'não salvo' : 'salvo'}
            </Text>
          </View>
          <BarPill label="Restaurar" icon="pricetag-outline" onPress={handleApplyDefaultPrices} />
        </View>
      </BrandHeader>

      <View style={[styles.catalogSection, contentStyle]}>
        <Text style={styles.catalogTitle}>Cardápio em uso</Text>
        <View style={styles.catalogRow} accessibilityRole="radiogroup">
          {CATALOGS.map((c) => {
            const active = menuCatalog === c.key;
            const busy = switchingCatalog === c.key;
            return (
              <AnimatedPressable
                key={c.key}
                style={[styles.catalogOption, active && styles.catalogOptionActive]}
                stateLayerColor={active ? colors.white : colors.onSurface}
                onPress={() => handleSelectCatalog(c.key)}
                disabled={switchingCatalog !== null}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                accessibilityLabel={MENU_CATALOG_LABELS[c.key]}
              >
                <Ionicons
                  name={active ? 'checkmark-circle' : 'ellipse-outline'}
                  size={18}
                  color={active ? colors.white : colors.textMuted}
                />
                <View style={styles.catalogTextWrap}>
                  <Text style={[styles.catalogLabel, active && styles.catalogLabelActive]} numberOfLines={1}>
                    {busy ? 'Trocando…' : c.label}
                  </Text>
                  <Text style={[styles.catalogHint, active && styles.catalogHintActive]} numberOfLines={1}>
                    {c.hint}
                  </Text>
                </View>
              </AnimatedPressable>
            );
          })}
        </View>
      </View>

      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((f) => {
            const active = activeFilter === f;
            const label = f === 'all' ? 'Todas' : CATEGORY_LABELS[f];
            return (
              <AnimatedPressable
                key={f}
                style={[styles.filterChip, active && styles.filterChipActive]}
                stateLayerColor={active ? colors.white : colors.onSurface}
                onPress={() => setActiveFilter(f)}
              >
                {f !== 'all' && (
                  <Ionicons
                    name={CATEGORY_ICONS[f]}
                    size={14}
                    color={active ? colors.white : colors.textSecondary}
                  />
                )}
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]} numberOfLines={1}>
                  {label}
                </Text>
              </AnimatedPressable>
            );
          })}
        </ScrollView>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {visibleCategories.map((cat) => {
            const items = draft.filter((i) => i.category === cat);
            return (
              <View key={cat} style={styles.section}>
                <View style={styles.sectionHead}>
                  <View style={styles.sectionIconWrap}>
                    <Ionicons name={CATEGORY_ICONS[cat]} size={15} color={colors.primary} />
                  </View>
                  <Text style={styles.sectionTitle}>{CATEGORY_LABELS[cat]}</Text>
                  <Text style={styles.sectionCount}>{items.length}</Text>
                </View>

                <View style={styles.card}>
                  {items.map((item) => (
                    <MenuItemRow
                      key={item.id}
                      item={item}
                      onUpdate={updateItem}
                      onRemove={setRemoveTarget}
                    />
                  ))}

                  {items.length === 0 && (
                    <Text style={styles.emptySection}>Nenhum item nesta categoria ainda.</Text>
                  )}

                  <AnimatedPressable
                    style={styles.addRow}
                    stateLayerColor={colors.primary}
                    onPress={() => handleAddItem(cat)}
                  >
                    <Ionicons name="add-circle-outline" size={17} color={colors.primary} />
                    <Text style={styles.addRowText}>Adicionar item</Text>
                  </AnimatedPressable>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={[styles.footer, contentStyle]}>
          <Button
            label={saving ? 'Salvando…' : 'Salvar Cardápio'}
            variant="primary"
            size="lg"
            loading={saving}
            disabled={!isDirty}
            onPress={handleSave}
          />
        </View>
      </KeyboardAvoidingView>

      <CatalogSwitchModal
        visible={catalogSwitch !== null}
        from={catalogSwitch?.from ?? menuCatalog}
        to={catalogSwitch?.to ?? menuCatalog}
        status={catalogSwitch?.status ?? 'confirm'}
        hasUnsavedChanges={isDirty}
        onConfirm={handleConfirmCatalog}
        onClose={handleCloseCatalogModal}
      />

      <ConfirmModal
        visible={removeTarget !== null}
        icon="trash-outline"
        iconColor={colors.danger}
        title="Remover item do cardápio?"
        message="Isso não afeta pedidos já lançados em mesas — só deixa de aparecer para novos pedidos."
        confirmLabel="Remover"
        destructive
        onConfirm={handleConfirmRemove}
        onCancel={() => setRemoveTarget(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: shape.full,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: { flex: 1 },
  subtitle: { fontFamily: font.medium, fontSize: 12.5, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  title: {
    fontFamily: font.extraBold,
    fontSize: 24,
    letterSpacing: -0.9,
    color: colors.white,
  },
  catalogSection: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  catalogTitle: {
    ...typography.caption,
    fontFamily: font.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.xs,
  },
  catalogRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  catalogOption: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 52,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: shape.large,
    overflow: 'hidden',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  catalogOptionActive: {
    backgroundColor: dashboardPalette.brand,
    borderColor: dashboardPalette.brand,
  },
  catalogTextWrap: { flex: 1, minWidth: 0 },
  catalogLabel: {
    ...typography.bodySm,
    fontFamily: font.bold,
    color: colors.textPrimary,
  },
  catalogLabelActive: { color: colors.white },
  catalogHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  catalogHintActive: { color: 'rgba(255,255,255,0.85)' },
  filterSection: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  filterScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  filterRow: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  filterChip: {
    flexDirection: 'row',
    flexShrink: 0,
    minHeight: 36,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: shape.full,
    overflow: 'hidden',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  filterChipActive: {
    backgroundColor: dashboardPalette.ink900,
    borderColor: dashboardPalette.ink900,
  },
  filterChipText: {
    ...typography.bodySm,
    fontFamily: font.semiBold,
    color: colors.textPrimary,
  },
  filterChipTextActive: {
    color: colors.white,
    fontFamily: font.bold,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  sectionIconWrap: {
    width: 26,
    height: 26,
    borderRadius: shape.medium,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    ...typography.h3,
    fontFamily: font.bold,
    color: colors.textPrimary,
    flex: 1,
  },
  sectionCount: {
    ...typography.caption,
    fontFamily: font.bold,
    color: colors.textMuted,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: shape.large,
    padding: spacing.xs,
    ...elevationShadow(1),
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  thumb: {
    width: 46,
    height: 46,
    borderRadius: shape.small + 2,
    flexShrink: 0,
  },
  thumbEmpty: {
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameInput: {
    flex: 1,
    minWidth: 0,
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: shape.medium,
    paddingHorizontal: 10,
    height: 46,
    fontSize: 14,
  },
  priceWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: shape.medium,
    paddingHorizontal: spacing.xs,
    height: 46,
    width: 62,
    gap: 2,
  },
  priceCurrency: {
    ...typography.caption,
    fontFamily: font.bold,
    color: colors.textMuted,
  },
  priceInput: {
    flex: 1,
    ...typography.body,
    fontFamily: font.bold,
    color: colors.textPrimary,
    height: '100%',
  },
  removeBtn: {
    width: 30,
    height: 30,
    flexShrink: 0,
    borderRadius: shape.full,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerMuted,
  },
  emptySection: {
    ...typography.bodySm,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    marginTop: spacing.xxs,
    borderRadius: shape.medium,
    overflow: 'hidden',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: `${dashboardPalette.brand}66`,
  },
  addRowText: {
    ...typography.bodySm,
    fontFamily: font.bold,
    color: colors.primary,
  },
  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
});
