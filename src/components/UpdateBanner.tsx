import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { applyUpdate, useAppUpdate } from '../hooks/useAppUpdate';
import { colors, font } from '../theme';
import { dashboardPalette } from '../theme/dashboardPalette';
import { AnimatedPressable } from './AnimatedPressable';

// Avisa que existe uma versão nova do app (só na versão web/instalada).
export function UpdateBanner() {
  const { updateAvailable } = useAppUpdate();
  const insets = useSafeAreaInsets();
  if (!updateAvailable) return null;

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + 78 }]} pointerEvents="box-none">
      <View style={styles.card}>
        <View style={styles.icon}>
          <Ionicons name="arrow-down-circle" size={20} color={colors.white} />
        </View>
        <View style={styles.texts}>
          <Text style={styles.title}>Nova versão disponível</Text>
          <Text style={styles.sub}>Atualize para ver as novidades.</Text>
        </View>
        <AnimatedPressable
          style={styles.button}
          stateLayerColor={colors.white}
          accessibilityRole="button"
          accessibilityLabel="Atualizar o app agora"
          onPress={applyUpdate}
        >
          <Text style={styles.buttonText}>Atualizar</Text>
        </AnimatedPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 14, right: 14, alignItems: 'center', zIndex: 70 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    maxWidth: 440,
    padding: 10,
    paddingLeft: 12,
    borderRadius: 20,
    backgroundColor: dashboardPalette.ink900,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: dashboardPalette.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1 },
  title: { fontFamily: font.bold, fontSize: 14, color: colors.white },
  sub: { fontFamily: font.medium, fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  button: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: dashboardPalette.brand,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  buttonText: { fontFamily: font.bold, fontSize: 13.5, color: colors.white },
});
