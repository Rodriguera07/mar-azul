import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LoginFoodMarquee } from './LoginFoodMarquee';
import { colors, font, spacing, typography } from '../theme';

interface Props {
  message?: string;
}

// Mesma linguagem da tela de login ("delivery"): fotos do cardápio em
// movimento sob um degradê escuro, coral + amarelo como acentos — a abertura
// do app, o login e o painel parecem uma única cena, não telas soltas.
const UI = {
  ink: '#140A06',
  accent: '#F0432B',
  accentLight: '#FF7A45',
  sun: '#FFB020',
};

function LoadingDots() {
  const anims = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = anims.map((val, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(val, {
            toValue: 1,
            duration: 420,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: 420,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay((2 - i) * 160),
        ])
      )
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [anims]);

  return (
    <View style={styles.dotsRow}>
      {anims.map((val, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            {
              opacity: val.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
              transform: [
                { translateY: val.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

// Tela de loading usada tanto na abertura do app (restaurando sessão /
// carregando fontes) quanto logo após o envio do login, pra evitar o corte
// seco de "formulário" direto pro painel.
export function LoadingScreen({ message = 'Carregando…' }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, [fade]);

  // Anel que se expande e some a partir do logo — indica "trabalhando" sem
  // depender de uma barra de progresso real.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  return (
    <View style={styles.flex}>
      <LoginFoodMarquee tile={84} />
      <LinearGradient
        colors={['rgba(20,10,6,0.78)', 'rgba(20,10,6,0.88)', 'rgba(20,10,6,0.97)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <Animated.View style={[styles.center, { opacity: fade }]}>
        <View style={styles.logoWrap}>
          <Animated.View
            style={[styles.ring, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
          />
          <View style={styles.logoBadge}>
            <Image source={require('../../assets/icon.png')} style={styles.logoImage} resizeMode="cover" />
          </View>
        </View>

        <Text style={styles.brandTiny}>TRAILER</Text>
        <Text style={styles.brandBig}>MAR AZUL</Text>

        <View style={styles.loaderWrap}>
          <LoadingDots />
          <Text style={styles.message}>{message}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: UI.ink },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  logoWrap: {
    width: 92,
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  ring: {
    position: 'absolute',
    width: 92,
    height: 92,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: UI.accentLight,
  },
  logoBadge: {
    width: 92,
    height: 92,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.92)',
    shadowColor: UI.accent,
    shadowOpacity: 0.5,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  logoImage: { width: '100%', height: '100%' },
  brandTiny: {
    ...typography.label,
    color: UI.sun,
    letterSpacing: 4,
  },
  brandBig: {
    ...typography.display,
    fontSize: 30,
    color: colors.white,
    letterSpacing: 1,
    marginTop: 2,
  },
  loaderWrap: {
    marginTop: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: UI.sun,
  },
  message: {
    ...typography.bodySm,
    fontFamily: font.semiBold,
    color: 'rgba(255,255,255,0.75)',
    marginTop: spacing.xs,
  },
});
