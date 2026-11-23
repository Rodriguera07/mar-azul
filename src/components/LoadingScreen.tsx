import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { colors, font, spacing } from '../theme';
import { dashboardPalette } from '../theme/dashboardPalette';

interface Props {
  message?: string;
}

const TRACK_WIDTH = 132;
const BAR_WIDTH = 52;

// Barra de progresso indeterminada: um trecho coral desliza pela trilha sem
// parar — indica "trabalhando" sem depender de um progresso real.
function IndeterminateBar() {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1300,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-BAR_WIDTH, TRACK_WIDTH],
  });

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.bar, { transform: [{ translateX }] }]} />
    </View>
  );
}

// Tela de loading usada tanto na abertura do app (restaurando sessão /
// carregando fontes) quanto logo após o envio do login, pra evitar o corte
// seco de "formulário" direto pro painel. Mesma linguagem do login: fundo
// neutro, logo com borda fina, coral só no indicador de progresso.
export function LoadingScreen({ message = 'Carregando…' }: Props) {
  const fade = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [fade]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });

  return (
    <View style={styles.flex}>
      <LinearGradient colors={['#FFFFFF', colors.background]} style={styles.wash} pointerEvents="none" />

      <Animated.View style={[styles.center, { opacity: fade }]}>
        <View style={styles.logoWrap}>
          <Animated.View
            style={[styles.ring, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
          />
          <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="cover" />
        </View>

        <Text style={styles.brandName}>Mar Azul</Text>
        <Text style={styles.brandTag}>Gestão do quiosque</Text>

        <View style={styles.loaderWrap}>
          <IndeterminateBar />
          <Text style={styles.message}>{message}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  wash: { position: 'absolute', top: 0, left: 0, right: 0, height: 420 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  logoWrap: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  ring: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: dashboardPalette.brand,
  },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
  },
  brandName: { fontFamily: font.bold, fontSize: 24, letterSpacing: -0.8, color: colors.textPrimary },
  brandTag: { fontFamily: font.medium, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  loaderWrap: { marginTop: spacing.xxl, alignItems: 'center', gap: spacing.sm },
  track: {
    width: TRACK_WIDTH,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceContainerHighest,
    overflow: 'hidden',
  },
  bar: {
    width: BAR_WIDTH,
    height: 4,
    borderRadius: 2,
    backgroundColor: dashboardPalette.brand,
  },
  message: { fontFamily: font.medium, fontSize: 13, color: colors.textSecondary },
});
