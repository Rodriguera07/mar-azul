import { LinearGradient } from 'expo-linear-gradient';
import React, { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dashboardPalette } from '../theme/dashboardPalette';

interface Props {
  children: ReactNode;
  // Folga embaixo do conteúdo: o cartão que "flutua" sobre a faixa entra
  // nesse espaço (efeito de apps de delivery, onde o saldo/busca sobrepõe o
  // cabeçalho colorido).
  bottomSpace?: number;
}

// Faixa de marca no topo das telas principais: degradê coral com círculos
// decorativos e cantos inferiores bem arredondados. Cobre a área da barra de
// status (usa o inset do topo), então a tela que a usa não precisa de
// SafeAreaView no topo.
export function BrandHeader({ children, bottomSpace = 22 }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={[dashboardPalette.brandLight, dashboardPalette.brand, dashboardPalette.brandDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.circleA} pointerEvents="none" />
      <View style={styles.circleB} pointerEvents="none" />
      <View style={{ paddingTop: insets.top + 12, paddingBottom: bottomSpace, paddingHorizontal: 16 }}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    backgroundColor: dashboardPalette.brand,
  },
  circleA: {
    position: 'absolute',
    top: -70,
    right: -50,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  circleB: {
    position: 'absolute',
    bottom: -90,
    left: -60,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
});
