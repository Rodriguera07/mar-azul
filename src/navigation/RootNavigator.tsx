import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { AdminNotificationToasts } from '../components/AdminNotificationToasts';
import { ConnectionBanner, LiveToasts } from '../components/LiveStatus';
import { useAuthStore } from '../context/useAuthStore';
import { usePosStore } from '../context/usePosStore';
import { LoginScreen } from '../screens/LoginScreen';
import { registerForPushNotificationsAsync } from '../services/notifications';
import { colors } from '../theme';
import { AppDrawer } from './AppDrawer';

type RootParamList = {
  Login: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootParamList>();

export function RootNavigator() {
  const status = useAuthStore((s) => s.status);
  const uid = useAuthStore((s) => s.user?.uid);
  const orgId = useAuthStore((s) => s.user?.orgId);
  const displayName = useAuthStore((s) => s.user?.displayName);
  const role = useAuthStore((s) => s.user?.role);

  useEffect(() => {
    if (uid && orgId && displayName) {
      usePosStore.getState().initOrgSync(orgId, { uid, displayName }, { liveToasts: role !== 'admin' });
      registerForPushNotificationsAsync(orgId, uid);
    } else {
      usePosStore.getState().teardownOrgSync();
    }
  }, [uid, orgId, displayName, role]);

  return (
    <>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {status === 'unauthenticated' ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <Stack.Screen name="Main" component={AppDrawer} />
        )}
      </Stack.Navigator>
      {status === 'authenticated' && <AdminNotificationToasts />}
      {status === 'authenticated' && <LiveToasts />}
      {status === 'authenticated' && <ConnectionBanner />}
    </>
  );
}
