import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { Platform } from 'react-native';
import { AddItemsScreen } from '../screens/AddItemsScreen';
import { AuditLogScreen } from '../screens/AuditLogScreen';
import { ChangePasswordScreen } from '../screens/ChangePasswordScreen';
import { CloseTableScreen } from '../screens/CloseTableScreen';
import { ClosedTableDetailScreen } from '../screens/ClosedTableDetailScreen';
import { ClosedTablesHistoryScreen } from '../screens/ClosedTablesHistoryScreen';
import { DeleteAccountScreen } from '../screens/DeleteAccountScreen';
import { EndDaySummaryScreen } from '../screens/EndDaySummaryScreen';
import { OpenTableScreen } from '../screens/OpenTableScreen';
import { PrivacyPolicyScreen } from '../screens/PrivacyPolicyScreen';
import { TableDetailScreen } from '../screens/TableDetailScreen';
import { TermsOfUseScreen } from '../screens/TermsOfUseScreen';
import { UserManagementScreen } from '../screens/UserManagementScreen';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { colors } from '../theme';
import { MainTabs } from './MainTabs';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

// react-native-screens does not fully support native modal presentation on
// web (dismissed modals can be left mounted/hidden instead of unmounted),
// so fall back to a regular card push there.
const modalPresentation = Platform.OS === 'web' ? 'card' : 'modal';

export function AppStack() {
  return (
    <Stack.Navigator
      // Cada tela ganha o seu próprio boundary: um erro de renderização fica
      // contido nela (com "Tentar novamente") em vez de deixar o app em branco.
      screenLayout={({ children }) => <ErrorBoundary scope="screen">{children}</ErrorBoundary>}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen
        name="OpenTable"
        component={OpenTableScreen}
        options={{ presentation: modalPresentation }}
      />
      <Stack.Screen name="TableDetail" component={TableDetailScreen} />
      <Stack.Screen
        name="AddItems"
        component={AddItemsScreen}
        options={{ presentation: modalPresentation }}
      />
      <Stack.Screen
        name="CloseTable"
        component={CloseTableScreen}
        options={{ presentation: modalPresentation }}
      />
      <Stack.Screen
        name="EndDaySummary"
        component={EndDaySummaryScreen}
        options={{ presentation: modalPresentation, gestureEnabled: false }}
      />
      <Stack.Screen name="ClosedTablesHistory" component={ClosedTablesHistoryScreen} />
      <Stack.Screen name="ClosedTableDetail" component={ClosedTableDetailScreen} />
      <Stack.Screen name="UserManagement" component={UserManagementScreen} />
      <Stack.Screen name="AuditLog" component={AuditLogScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="TermsOfUse" component={TermsOfUseScreen} />
      <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
    </Stack.Navigator>
  );
}
