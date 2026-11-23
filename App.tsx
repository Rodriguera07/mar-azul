import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { LoadingScreen } from './src/components/LoadingScreen';
import { UpdateBanner } from './src/components/UpdateBanner';
import { initAuthListener, useAuthStore } from './src/context/useAuthStore';
import { useMinimumVisible } from './src/hooks/useMinimumVisible';
import { RootNavigator } from './src/navigation/RootNavigator';
import { colors } from './src/theme';

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.surface,
    border: colors.border,
    primary: colors.primary,
    text: colors.textPrimary,
  },
};

export default function App() {
  useEffect(() => initAuthListener(), []);

  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  const authStatus = useAuthStore((s) => s.status);

  // Se a restauração do login travar (armazenamento do Safari bloqueado, rede
  // ruim), o app ficava preso na tela de carregamento. Passado o tempo limite,
  // segue para o login — e se a sessão enfim voltar, o listener a restaura.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (useAuthStore.getState().status === 'loading') {
        useAuthStore.setState({ status: 'unauthenticated', user: null });
      }
    }, 12000);
    return () => clearTimeout(timer);
  }, []);

  // Fontes e sessão costumam resolver quase instantaneamente (cache local),
  // o que fazia esse loading só "piscar" na tela. Sustenta a mesma duração
  // mínima usada depois do login, pra dar tempo do usuário apreciar o app.
  // Se a fonte falhar ao carregar (rede ruim, bloqueio), segue com a fonte do
  // sistema em vez de ficar preso na tela de loading para sempre.
  const bootReady = (fontsLoaded || fontError != null) && authStatus !== 'loading';
  const showBootLoading = useMinimumVisible(!bootReady);

  if (showBootLoading) {
    return <LoadingScreen />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <ErrorBoundary scope="app">
          <NavigationContainer theme={navigationTheme}>
            <RootNavigator />
          </NavigationContainer>
          <UpdateBanner />
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
