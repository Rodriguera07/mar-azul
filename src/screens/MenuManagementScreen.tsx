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
import { AppDialog } from '../components/AppDialog';
import { CatalogSwitchModal, type CatalogSwitchStatus } from '../components/CatalogSwitchModal';
import { PriceChangeList, pickPriceExamples, type PriceExample } from '../components/PriceChangeList';
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
import { generateId } from '../utils/id';

type Props = TabScreenProps<'Produtos'>;
type CategoryFilter = MenuCategory | 'all';

const CATEGORIES: MenuCategory[] = ['bebidas', 'drinks', 'doses', 'porcoes', 'pasteis'];
const FILTERS: CategoryFilter[] = ['all', ...CATEGORIES];
const CATALOGS: { key: MenuCatalog; label: string; hint: string }[] = [
  { key: 'novo', label: 'Novo', hint: 'Tabela atual' },
  { key: 'antigo', label: 'Antigo', hint: 'Tabela anterior' },
];

// Janelas de aviso da tela (no visual do app, no lugar dos alertas do
// navegador). Só uma aparece por vez.
type MenuDialog =
  | { kind: 'restore-confirm'; items: MenuItem[]; changed: number; added: number; removed: number; examples: PriceExample[]; total: number }
  | { kind: 'restore-uptodate' }
  | { kind: 'restore-done'; changed: number; added: number; removed: number }
  | { kind: 'discard' }
  | { kind: 'invalid'; count: number }
  | { kind: 'saved' }
  | { kind: 'save-error' };

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

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
  const [dialog, setDialog] = useState<MenuDialog | null>(null);
  const closeDialog = () => setDialog(null);
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

  // Restaurar: volta os itens padrão para a tabela do cardápio em uso. Antes
  // de confirmar, a janela mostra quantos itens mudam e exemplos de preços.
  // Nada é gravado até o admin tocar em "Salvar Cardápio".
  const handleApplyDefaultPrices = () => {
    const result = applyDefaultPrices(draft, menuCatalog);
    if (result.changed === 0 && result.added === 0 && result.removed === 0) {
      setDialog({ kind: 'restore-uptodate' });
      return;
    }
    const { examples, total } = pickPriceExamples(draft, result.items);
    setDialog({ kind: 'restore-confirm', ...result, examples, total });
  };

  const confirmRestore = () => {
    if (dialog?.kind !== 'restore-confirm') return;
    setHasEdited(true);
    setDraft(dialog.items);
    setDialog({ kind: 'restore-done', changed: dialog.changed, added: dialog.added, removed: dialog.removed });
  };

  const handleBack = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  const handleGoBackPress = () => {
    if (!isDirty) {
      handleBack();
      return;
    }
    setDialog({ kind: 'discard' });
  };

  const handleSave = async () => {
    const invalidCount = draft.filter((i) => !i.name.trim() || i.price <= 0).length;
    if (invalidCount > 0) {
      setDialog({ kind: 'invalid', count: invalidCount });
      return;
    }
    setDialog(null);
    setSaving(true);
    const ok = await saveMenuItems(draft.map(stripImage));
    setSaving(false);
    if (ok) setHasEdited(false);
    setDialog({ kind: ok ? 'saved' : 'save-error' });
  };

  const catalogLabel = MENU_CATALOG_LABELS[menuCatalog].toLowerCase();

  const renderDialog = () => {
    if (!dialog) return null;
    switch (dialog.kind) {
      case 'restore-confirm':
        return (
          <AppDialog
            visible
            tone="info"
            icon="pricetag-outline"
            title="Restaurar preços?"
            message={`Os itens padrão voltam para a tabela do ${catalogLabel}. Itens que você criou não mudam.`}
            primaryLabel="Restaurar"
            onPrimary={confirmRestore}
            secondaryLabel="Cancelar"
            onSecondary={closeDialog}
          >
            <View style={styles.dialogChips}>
              {dialog.changed > 0 && (
                <View style={styles.dialogChip}>
                  <Text style={styles.dialogChipText}>{plural(dialog.changed, 'atualizado', 'atualizados')}</Text>
                </View>
              )}
              {dialog.added > 0 && (
                <View style={styles.dialogChip}>
                  <Text style={styles.dialogChipText}>{plural(dialog.added, 'adicionado', 'adicionados')}</Text>
                </View>
              )}
              {dialog.removed > 0 && (
                <View style={styles.dialogChip}>
                  <Text style={styles.dialogChipText}>{plural(dialog.removed, 'retirado', 'retirados')}</Text>
                </View>
              )}
            </View>
            <PriceChangeList examples={dialog.examples} total={dialog.total} />
            <Text style={styles.dialogNote}>
              Depois, toque em "Salvar Cardápio" para valer para a equipe.
            </Text>
          </AppDialog>
        );
      case 'restore-uptodate':
        return (
          <AppDialog
            visible
            tone="success"
            title="Tudo em dia"
            message={`O cardápio já está com os preços do ${catalogLabel}.`}
            primaryLabel="Entendi"
            onPrimary={closeDialog}
          />
        );
      case 'restore-done':
        return (
          <AppDialog
            visible
            tone="success"
            icon="pricetag"
            title="Preços restaurados"
            message="Falta salvar para a equipe passar a ver os preços restaurados."
            primaryLabel="Salvar agora"
            onPrimary={handleSave}
            secondaryLabel="Depois"
            onSecondary={closeDialog}
          />
        );
      case 'discard':
        return (
          <AppDialog
            visible
            tone="warning"
            title="Descartar alterações?"
            message="Você tem mudanças no cardápio que ainda não foram salvas. Se sair agora, elas serão perdidas."
            primaryLabel="Descartar"
            primaryVariant="danger"
            onPrimary={() => {
              setDialog(null);
              setHasEdited(false);
              setDraft(menuItems);
              handleBack();
            }}
            secondaryLabel="Continuar editando"
            onSecondary={closeDialog}
          />
        );
      case 'invalid':
        return (
          <AppDialog
            visible
            tone="warning"
            title="Revise o cardápio"
            message={`${plural(dialog.count, 'item está', 'itens estão')} sem nome ou com valor zerado. Todo item precisa de nome e de um valor maior que zero.`}
            primaryLabel="Revisar"
            onPrimary={closeDialog}
          />
        );
      case 'saved':
        return (
          <AppDialog
            visible
            tone="success"
            title="Cardápio salvo"
            message="As alterações já estão disponíveis para toda a equipe."
            primaryLabel="Entendi"
            onPrimary={closeDialog}
          />
        );
      case 'save-error':
        return (
          <AppDialog
            visible
            tone="danger"
            icon="cloud-offline-outline"
            title="Não foi possível salvar"
            message="Verifique a conexão com a internet e tente de novo. Suas alterações continuam na tela."
            primaryLabel="Tentar de novo"
            onPrimary={handleSave}
            secondaryLabel="Fechar"
            onSecondary={closeDialog}
          />
        );
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

      {renderDialog()}

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
  dialogChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  dialogChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: shape.full,
    backgroundColor: colors.primaryMuted,
  },
  dialogChipText: {
    fontFamily: font.semiBold,
    fontSize: 12,
    color: colors.onPrimaryContainer,
  },
  dialogNote: {
    fontFamily: font.medium,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
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
