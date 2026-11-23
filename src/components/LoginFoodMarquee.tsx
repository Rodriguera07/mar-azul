import React, { useEffect, useMemo, useRef } from 'react';
import { isAppleMobileWeb } from '../utils/platform';
import { Animated, Easing, Image, ImageSourcePropType, StyleSheet, useWindowDimensions, View } from 'react-native';

// Fotos reais do cardápio, em três faixas inclinadas que deslizam sem parar
// em sentidos alternados — mesma linguagem de apps de delivery (fundo vivo
// com comida, texto por cima de um degradê escuro).
const ROWS: ImageSourcePropType[][] = [
  [
    require('../../assets/menu/camarao.jpg'),
    require('../../assets/menu/batata.jpg'),
    require('../../assets/menu/caipirinhas.jpg'),
    require('../../assets/menu/porcao-mista.jpg'),
    require('../../assets/menu/pastel.jpg'),
    require('../../assets/menu/sucos-naturais.jpg'),
  ],
  [
    require('../../assets/menu/porcao-lula.jpg'),
    require('../../assets/menu/batidas.jpg'),
    require('../../assets/menu/porcao-calabresa.jpg'),
    require('../../assets/menu/espanhola.jpg'),
    require('../../assets/menu/porcao-iscas.jpg'),
    require('../../assets/menu/refrigerantes.jpg'),
  ],
  [
    require('../../assets/menu/porcao-cacao.jpg'),
    require('../../assets/menu/porcao-mandioca.jpg'),
    require('../../assets/menu/doses.jpg'),
    require('../../assets/menu/porcao-cebola.jpg'),
    require('../../assets/menu/por-frango.jpg'),
    require('../../assets/menu/agua.jpg'),
  ],
];

const GAP = 10;
const DURATIONS = [38000, 46000, 42000];

function Row({ images, tile, reverse, duration }: {
  images: ImageSourcePropType[];
  tile: number;
  reverse: boolean;
  duration: number;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const rowWidth = images.length * (tile + GAP);

  useEffect(() => {
    // No iPhone a faixa fica parada: uma animação infinita dentro de uma área
    // girada e recortada faz o WebKit repintar a tela o tempo todo (e piscar).
    if (isAppleMobileWeb) return;
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [progress, duration]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: reverse ? [-rowWidth, 0] : [0, -rowWidth],
  });

  // Conteúdo duplicado: quando a primeira metade sai da tela, a segunda
  // ocupa exatamente o mesmo lugar e o loop recomeça sem salto.
  const loopImages = [...images, ...images, ...images];

  return (
    <Animated.View style={[styles.row, { transform: [{ translateX }] }]}>
      {loopImages.map((src, i) => (
        <Image
          key={i}
          source={src}
          style={{ width: tile, height: tile, borderRadius: 22, marginRight: GAP }}
          resizeMode="cover"
        />
      ))}
    </Animated.View>
  );
}

export function LoginFoodMarquee({ tile, height: areaHeight }: { tile: number; height?: number }) {
  const { height: windowHeight } = useWindowDimensions();
  // Só gera faixas para a área visível (o hero do login é bem menor que a tela).
  const height = areaHeight ?? windowHeight;
  // Faixas suficientes para cobrir a tela inteira (o conjunto é inclinado,
  // então sobram duas de margem para não aparecer vazio nos cantos).
  const count = Math.ceil(height / (tile + GAP)) + 2;
  const rows = useMemo(
    () => Array.from({ length: count }, (_, i) => ROWS[i % ROWS.length]),
    [count]
  );
  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.tilt}>
        {rows.map((images, i) => (
          <Row
            key={i}
            images={images}
            tile={tile}
            reverse={i % 2 === 1}
            duration={DURATIONS[i % DURATIONS.length]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tilt: {
    width: '160%',
    gap: GAP,
    transform: [{ rotate: '-9deg' }],
  },
  row: {
    flexDirection: 'row',
  },
});
