import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

interface Props {
  color?: string;
  size?: number;
}

export function PulseDot({ color = colors.emerald, size = 7 }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Na web o Animated não tem driver nativo: o loop rodaria em JavaScript,
    // reescrevendo o estilo a ~60 quadros por segundo para sempre, em cima do
    // cabeçalho com degradê/bordas recortadas — no WebKit do iPhone isso
    // repinta a tela inteira sem parar (piscada). Lá a animação é CSS.
    if (Platform.OS === 'web') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  if (Platform.OS === 'web') {
    // `animationKeyframes` é extensão do react-native-web (vira CSS @keyframes,
    // animado pelo compositor, sem JavaScript por quadro).
    const ringStyle: any = {
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: color,
      animationKeyframes: [
        { '0%': { opacity: 0.55, transform: [{ scale: 1 }] }, '100%': { opacity: 0, transform: [{ scale: 2.4 }] } },
      ],
      animationDuration: '1100ms',
      animationTimingFunction: 'ease-out',
      animationIterationCount: 'infinite',
    };
    return (
      <View style={[styles.wrap, { width: size, height: size }]}>
        <View pointerEvents="none" style={[styles.ring, ringStyle]} />
        <View
          style={[styles.core, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}
        />
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            opacity,
            transform: [{ scale }],
          },
        ]}
      />
      <View
        style={[styles.core, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
  },
  core: {},
});
