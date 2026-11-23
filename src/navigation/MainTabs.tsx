import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useAuthStore } from '../context/useAuthStore';
import { DashboardScreen } from '../screens/DashboardScreen';
import { MenuManagementScreen } from '../screens/MenuManagementScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import { TablesScreen } from '../screens/TablesScreen';
import { colors, font } from '../theme';
import { dashboardPalette } from '../theme/dashboardPalette';
import { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

const TAB_ICON: Record<
  keyof TabParamList,
  { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }
> = {
  Painel: { on: 'grid', off: 'grid-outline' },
  Mesas: { on: 'restaurant', off: 'restaurant-outline' },
  Produtos: { on: 'book', off: 'book-outline' },
  Relatorios: { on: 'stats-chart', off: 'stats-chart-outline' },
};

function TabIcon({ name, focused, color }: { name: keyof TabParamList; focused: boolean; color: string }) {
  const icon = TAB_ICON[name];
  return <Ionicons name={focused ? icon.on : icon.off} size={22} color={color} />;
}

// Barra de abas fixa (Painel / Mesas / Produtos / Relatórios) — navegação
// principal do app, igual ao mock de referência. "Produtos" (cardápio) só
// aparece para admin, mesma restrição que já existia no menu lateral.
export function MainTabs() {
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin');
  // Barra de gestos do Android / indicador home do iPhone reservam uma faixa
  // que varia por aparelho — uma altura fixa cortava os ícones/labels em
  // telas com esse inset maior. `insets.bottom` cresce a barra na medida
  // exata que cada aparelho precisa.
  const insets = useSafeAreaInsets();
  const tabBarBottomPadding = Math.max(8, insets.bottom);

  return (
    <Tab.Navigator
      screenLayout={({ children }) => <ErrorBoundary scope="screen">{children}</ErrorBoundary>}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: dashboardPalette.brand,
        tabBarInactiveTintColor: colors.textMuted,
        sceneStyle: { backgroundColor: colors.background },
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopWidth: 0,
          borderTopLeftRadius: 26,
          borderTopRightRadius: 26,
          height: 62 + tabBarBottomPadding,
          paddingTop: 8,
          paddingBottom: tabBarBottomPadding,
          shadowColor: '#0B1B3B',
          shadowOpacity: 0.10,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: -6 },
          elevation: 16,
        },
        tabBarIcon: ({ focused, color }) => (
          <TabIcon name={route.name as keyof TabParamList} focused={focused} color={color} />
        ),
        // Em telas estreitas (~320-360px), 4 abas deixam pouco espaço por
        // label — sem limitar a 1 linha, "Relatórios" quebrava e ficava
        // cortado pela altura fixa da barra.
        tabBarLabel: ({ color, children }) => (
          <Text numberOfLines={1} style={[styles.label, { color }]}>
            {children}
          </Text>
        ),
      })}
    >
      <Tab.Screen name="Painel" component={DashboardScreen} />
      <Tab.Screen name="Mesas" component={TablesScreen} />
      <Tab.Screen
        name="Produtos"
        component={MenuManagementScreen}
        // O papel do usuário pode mudar em tempo real (outro admin o
        // rebaixa durante a sessão) — desmontar/remontar a Screen nesse
        // momento não é suportado pelo React Navigation, então a aba
        // sempre existe e só o botão/gesto de acesso é ocultado.
        options={{
          title: 'Cardápio',
          ...(isAdmin ? null : { tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }),
        }}
      />
      <Tab.Screen name="Relatorios" component={ReportsScreen} options={{ title: 'Relatórios' }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: font.semiBold,
    fontSize: 10.5,
    textAlign: 'center',
    marginTop: 2,
  },
});
