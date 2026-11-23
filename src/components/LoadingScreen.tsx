import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { LoginFoodMarquee } from './LoginFoodMarquee';
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
// seco de "formulário" direto pro painel. Splash de marca em coral (como nos
// apps de delivery), com as fotos do cardápio bem suaves ao fundo.
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
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <View style={styles.flex}>
      <LoginFoodMarquee tile={84} />
      <LinearGradient
        colors={[
          `${dashboardPalette.brandLight}EB`,
          `${dashboardPalette.brand}F0`,
          `${dashboardPalette.brandDark}F5`,
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <Animated.View style={[styles.center, { opacity: fade }]}>
        <View style={styles.logoWrap}>
          <Animated.View
            style={[styles.ring, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
          />
          <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="cover" />
        </View>

        <Text style={styles.brandTiny}>TRAILER</Text>
        <Text style={styles.brandName}>MAR AZUL</Text>

        <View style={styles.loaderWrap}>
          <IndeterminateBar />
          <Text style={styles.message}>{message}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: dashboardPalette.brand },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  logoWrap: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  ring: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 26,
    borderWidth: 2.5,
    borderColor: colors.white,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.95)',
  },
  brandTiny: { fontFamily: font.bold, fontSize: 11, letterSpacing: 4, color: dashboardPalette.amberSoft },
  brandName: { fontFamily: font.extraBold, fontSize: 30, letterSpacing: -0.8, color: colors.white, marginTop: 2 },
  loaderWrap: { marginTop: spacing.xxl, alignItems: 'center', gap: spacing.sm },
  track: {
    width: TRACK_WIDTH,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.28)',
    overflow: 'hidden',
  },
  bar: {
    width: BAR_WIDTH,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.white,
  },
  message: { fontFamily: font.semiBold, fontSize: 13, color: 'rgba(255,255,255,0.88)' },
});
