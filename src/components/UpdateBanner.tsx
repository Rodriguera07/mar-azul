import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { applyUpdate, useAppUpdate } from '../hooks/useAppUpdate';
import { colors, font } from '../theme';
import { dashboardPalette } from '../theme/dashboardPalette';
import { AnimatedPressable } from './AnimatedPressable';

// Avisa que existe uma versão nova do app (só na versão web/instalada) e, quando
// a publicação traz o arquivo de novidades, mostra o que mudou.
export function UpdateBanner() {
  const { updateAvailable, notes } = useAppUpdate();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(false);
  if (!updateAvailable) return null;

  const hasList = !!notes && notes.items.length > 0;
  const subtitle = notes?.title ? `Novidade: ${notes.title}` : 'Atualize para ver as novidades.';

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + 78 }]} pointerEvents="box-none">
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.icon}>
            <Ionicons name="sparkles" size={18} color={colors.white} />
          </View>
          <View style={styles.texts}>
            <Text style={styles.title}>Nova versão disponível</Text>
            <Text style={styles.sub} numberOfLines={expanded ? undefined : 1}>
              {subtitle}
            </Text>
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

        {hasList && expanded && (
          <View style={styles.list}>
            {notes!.items.map((item, i) => (
              <View key={i} style={styles.listRow}>
                <Ionicons name="checkmark-circle" size={15} color={dashboardPalette.aqua} />
                <Text style={styles.listText}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        {hasList && (
          <Pressable
            onPress={() => setExpanded((v) => !v)}
            style={styles.toggle}
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Esconder o que mudou' : 'Ver o que mudou'}
            hitSlop={6}
          >
            <Text style={styles.toggleText}>{expanded ? 'Esconder' : 'Ver o que mudou'}</Text>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={dashboardPalette.aquaSoft} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 14, right: 14, alignItems: 'center', zIndex: 70 },
  card: {
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: dashboardPalette.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, minWidth: 0 },
  title: { fontFamily: font.bold, fontSize: 14, color: colors.white },
  sub: { fontFamily: font.medium, fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
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
  list: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
    gap: 7,
  },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  listText: {
    flex: 1,
    fontFamily: font.medium,
    fontSize: 12.5,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.88)',
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 8,
    marginLeft: 46,
    paddingVertical: 2,
  },
  toggleText: { fontFamily: font.semiBold, fontSize: 12, color: dashboardPalette.aquaSoft },
});
