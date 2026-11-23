import { Ionicons } from '@expo/vector-icons';
import { DrawerContentComponentProps, useDrawerProgress } from '@react-navigation/drawer';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ScrollView, StyleSheet, Text, View, ViewStyle } from 'react-native';
import ReanimatedAnimated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { useAuthStore } from '../context/useAuthStore';
import { getBuildId } from '../hooks/useAppUpdate';
import { colors, elevationShadow, font, radius, shape, spacing, typography } from '../theme';
import { dashboardPalette } from '../theme/dashboardPalette';
import { RootStackParamList } from './types';

type NoParamRoute = {
  [K in keyof RootStackParamList]: RootStackParamList[K] extends undefined ? K : never;
}[keyof RootStackParamList];

interface DrawerItem {
  key: NoParamRoute;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  muted: string;
  adminOnly?: boolean;
  // Entra na seção "Configurações" (conta, privacidade, dados), visível a
  // qualquer papel — diferente de `adminOnly`, exclusivo de admin.
  settingsSection?: boolean;
}

const NAV_ITEMS: DrawerItem[] = [
  {
    key: 'ClosedTablesHistory',
    label: 'Histórico de Mesas',
    icon: 'time-outline',
    color: dashboardPalette.positive,
    muted: `${dashboardPalette.positive}1F`,
  },
  {
    key: 'UserManagement',
    label: 'Gerenciar Usuários',
    icon: 'people-outline',
    color: dashboardPalette.rose,
    muted: `${dashboardPalette.rose}1F`,
    adminOnly: true,
  },
  {
    key: 'AuditLog',
    label: 'Log de Auditoria',
    icon: 'document-text-outline',
    color: dashboardPalette.amber,
    muted: `${dashboardPalette.amber}1F`,
    adminOnly: true,
  },
  {
    key: 'ChangePassword',
    label: 'Alterar Senha',
    icon: 'key-outline',
    color: dashboardPalette.brand,
    muted: `${dashboardPalette.brand}1F`,
    settingsSection: true,
  },
  {
    key: 'PrivacyPolicy',
    label: 'Política de Privacidade',
    icon: 'shield-checkmark-outline',
    color: dashboardPalette.mint,
    muted: `${dashboardPalette.mint}1F`,
    settingsSection: true,
  },
  {
    key: 'TermsOfUse',
    label: 'Termo de Uso',
    icon: 'document-text-outline',
    color: dashboardPalette.amber,
    muted: `${dashboardPalette.amber}1F`,
    settingsSection: true,
  },
  {
    key: 'DeleteAccount',
    label: 'Excluir Minha Conta',
    icon: 'trash-outline',
    color: dashboardPalette.rose,
    muted: `${dashboardPalette.rose}1F`,
    settingsSection: true,
  },
];

const ROLE_LABEL: Record<'admin' | 'staff', string> = {
  admin: 'Administrador',
  staff: 'Equipe',
};

const ROLE_ICON: Record<'admin' | 'staff', keyof typeof Ionicons.glyphMap> = {
  admin: 'shield-checkmark',
  staff: 'person',
};

// Cada linha entra com um leve fade + deslize, escalonado por índice e
// atrelado ao progresso real do gesto/mola do drawer (useDrawerProgress) —
// assim a entrada acompanha exatamente a suavidade da animação de abrir,
// em vez de rodar solta em paralelo.
function useStaggerStyle(index: number, total: number): ViewStyle {
  const progress = useDrawerProgress();
  const start = 0.15 + (index / total) * 0.5;
  const end = start + 0.4;
  return useAnimatedStyle(() => {
    const t = interpolate(progress.value, [start, end], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: t,
      transform: [{ translateX: interpolate(t, [0, 1], [-14, 0]) }],
    };
  }) as unknown as ViewStyle;
}

function SectionLabel({ label, index, total }: { label: string; index: number; total: number }) {
  const style = useStaggerStyle(index, total);
  return (
    <ReanimatedAnimated.View style={style}>
      <Text style={styles.sectionLabel}>{label}</Text>
    </ReanimatedAnimated.View>
  );
}

function DrawerNavRow({
  item,
  index,
  total,
  active,
  last,
  onPress,
}: {
  item: DrawerItem;
  index: number;
  total: number;
  active: boolean;
  last: boolean;
  onPress: () => void;
}) {
  const staggerStyle = useStaggerStyle(index, total);
  const danger = item.key === 'DeleteAccount';
  const tone = danger ? dashboardPalette.rose : dashboardPalette.brand;
  const toneBg = danger ? `${dashboardPalette.rose}14` : colors.primaryMuted;

  return (
    <ReanimatedAnimated.View style={staggerStyle}>
      <AnimatedPressable
        scaleTo={0.99}
        stateLayerColor={tone}
        accessibilityRole="button"
        accessibilityLabel={item.label}
        style={[styles.item, active && { backgroundColor: toneBg }]}
        onPress={onPress}
      >
        <View style={[styles.itemIconWrap, { backgroundColor: toneBg }]}>
          <Ionicons name={item.icon} size={19} color={tone} />
        </View>
        <Text
          style={[
            styles.itemLabel,
            danger && { color: dashboardPalette.rose },
            active && { color: tone, fontFamily: font.bold },
          ]}
          numberOfLines={1}
        >
          {item.label}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={active ? tone : colors.textMuted} />
      </AnimatedPressable>
      {!last && <View style={styles.rowDivider} />}
    </ReanimatedAnimated.View>
  );
}

function Section({
  label,
  items,
  startIndex,
  total,
  activeRouteName,
  onNavigate,
}: {
  label: string;
  items: DrawerItem[];
  startIndex: number;
  total: number;
  activeRouteName?: string;
  onNavigate: (key: NoParamRoute) => void;
}) {
  return (
    <View style={styles.section}>
      <SectionLabel label={label} index={startIndex} total={total} />
      <View style={styles.sectionCard}>
        {items.map((item, i) => (
          <DrawerNavRow
            key={item.key}
            item={item}
            index={startIndex + 1 + i}
            total={total}
            active={activeRouteName === item.key}
            last={i === items.length - 1}
            onPress={() => onNavigate(item.key)}
          />
        ))}
      </View>
    </View>
  );
}

export function AppDrawerContent({ navigation, state }: DrawerContentComponentProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const insets = useSafeAreaInsets();

  const activeRouteName = getActiveInnerRouteName(state);
  const initial = (user?.displayName ?? 'U').charAt(0).toUpperCase();
  const mainItems = NAV_ITEMS.filter((item) => !item.adminOnly && !item.settingsSection);
  // "Administração" é exclusiva de quem é admin (gestão de usuários, log de
  // auditoria) — some da tela para a equipe. "Configurações" reúne conta,
  // privacidade e dados, e aparece para qualquer papel.
  const adminItems = NAV_ITEMS.filter((item) => item.adminOnly && user?.role === 'admin');
  const settingsItems = NAV_ITEMS.filter((item) => item.settingsSection);
  const totalStagger = mainItems.length + adminItems.length + settingsItems.length + 4;
  const headerStyle = useStaggerStyle(-1, totalStagger);

  const navigateTo = (key: NoParamRoute) => {
    navigation.navigate('AppStack', { screen: key });
    navigation.closeDrawer();
  };

  return (
    <View style={styles.outer}>
      <LinearGradient
        colors={[dashboardPalette.brandLight, dashboardPalette.brand, dashboardPalette.brandDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 22 }]}
      >
        <View style={[styles.bubble, styles.bubbleLg]} pointerEvents="none" />
        <View style={[styles.bubble, styles.bubbleSm]} pointerEvents="none" />
        <ReanimatedAnimated.View style={[styles.headerContent, headerStyle]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.name} numberOfLines={1}>
              {user?.displayName ?? 'Usuário'}
            </Text>
            {user?.email ? (
              <Text style={styles.email} numberOfLines={1}>
                {user.email}
              </Text>
            ) : null}
            {user ? (
              <View style={styles.roleBadge}>
                <Ionicons name={ROLE_ICON[user.role]} size={11} color={colors.white} />
                <Text style={styles.roleBadgeText}>{ROLE_LABEL[user.role]}</Text>
              </View>
            ) : null}
          </View>
        </ReanimatedAnimated.View>
      </LinearGradient>

      <ScrollView
        style={styles.itemsList}
        contentContainerStyle={styles.itemsListContent}
        showsVerticalScrollIndicator={false}
      >
        <Section
          label="Menu"
          items={mainItems}
          startIndex={0}
          total={totalStagger}
          activeRouteName={activeRouteName}
          onNavigate={navigateTo}
        />
        {adminItems.length > 0 && (
          <Section
            label="Administração"
            items={adminItems}
            startIndex={mainItems.length + 1}
            total={totalStagger}
            activeRouteName={activeRouteName}
            onNavigate={navigateTo}
          />
        )}
        {settingsItems.length > 0 && (
          <Section
            label="Configurações"
            items={settingsItems}
            startIndex={mainItems.length + adminItems.length + 2}
            total={totalStagger}
            activeRouteName={activeRouteName}
            onNavigate={navigateTo}
          />
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <AnimatedPressable
          scaleTo={0.98}
          stateLayerColor={dashboardPalette.rose}
          accessibilityRole="button"
          accessibilityLabel="Sair"
          style={styles.logoutBtn}
          onPress={logout}
        >
          <Ionicons name="log-out-outline" size={19} color={dashboardPalette.rose} />
          <Text style={styles.logoutText}>Sair da conta</Text>
        </AnimatedPressable>
        <Text style={styles.version}>
          Trailer Mar Azul{getBuildId() ? ` · versão ${getBuildId()}` : ''}
        </Text>
      </View>
    </View>
  );
}

// O state da Drawer.Navigator só sabe o nome da rota filha ("AppStack"); o
// nome da tela ativa de fato mora dentro do state aninhado da native-stack.
function getActiveInnerRouteName(state: DrawerContentComponentProps['state']): string | undefined {
  const drawerRoute = state.routes[state.index];
  const nested = drawerRoute.state;
  if (!nested || nested.index == null) return undefined;
  return nested.routes[nested.index]?.name;
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: colors.background, borderTopRightRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' },
  header: {
    overflow: 'hidden',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg + 4,
    borderBottomRightRadius: 30,
  },
  bubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)' },
  bubbleLg: { width: 190, height: 190, top: -70, right: -60 },
  bubbleSm: { width: 120, height: 120, bottom: -50, left: -30, backgroundColor: 'rgba(255,255,255,0.07)' },
  headerContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: font.extraBold, fontSize: 24, color: dashboardPalette.brand },
  headerText: { flex: 1, minWidth: 0 },
  name: { fontFamily: font.extraBold, fontSize: 19, letterSpacing: -0.6, color: colors.white },
  email: { fontFamily: font.medium, fontSize: 12.5, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: shape.full,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  roleBadgeText: { fontFamily: font.bold, fontSize: 11.5, color: colors.white },
  itemsList: { flex: 1 },
  itemsListContent: { padding: spacing.md, paddingTop: spacing.lg, gap: spacing.md },
  section: { gap: 8 },
  sectionLabel: {
    fontFamily: font.bold,
    fontSize: 11.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    paddingHorizontal: 6,
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: 22,
    overflow: 'hidden',
    ...elevationShadow(1),
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  itemIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: { flex: 1, fontFamily: font.semiBold, fontSize: 15, letterSpacing: -0.2, color: colors.textPrimary },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing.md + 38 + spacing.sm + 2,
  },
  footer: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.xs },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 18,
    backgroundColor: `${dashboardPalette.rose}14`,
    overflow: 'hidden',
  },
  logoutText: { fontFamily: font.bold, fontSize: 15, color: dashboardPalette.rose },
  version: { fontFamily: font.medium, fontSize: 11.5, color: colors.textMuted, textAlign: 'center' },
});
