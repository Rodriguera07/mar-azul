import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

interface Props {
  color?: string;
  size?: number;
}

// Ponto de "ao vivo / aberto" com um halo suave FIXO. Antes o halo pulsava com
// uma animação infinita; no iPhone (Safari/WebKit) esse tipo de animação
// contínua, dentro de áreas arredondadas e recortadas, forçava a tela inteira
// a ser repintada o tempo todo e ela passava a piscar/falhar na pintura (vídeo
// do cliente). Sem animação contínua, a tela fica parada quando nada muda.
export function PulseDot({ color = colors.emerald, size = 7 }: Props) {
  const halo = Math.round(size * 2.2);
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <View
        style={[
          styles.halo,
          { width: halo, height: halo, borderRadius: halo / 2, backgroundColor: color },
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
  halo: {
    position: 'absolute',
    opacity: 0.22,
  },
  core: {},
});
