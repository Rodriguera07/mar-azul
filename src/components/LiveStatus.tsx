import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { consumeLiveEvent, useLiveEvents } from '../services/liveFeed';
import { SyncState, useSyncStatus } from '../services/syncStatus';
import { colors, font, shape } from '../theme';
import { dashboardPalette } from '../theme/dashboardPalette';
import { PulseDot } from './PulseDot';

const LABEL: Record<SyncState, string> = {
  live: 'Ao vivo',
  reconnecting: 'Reconectando…',
  offline: 'Sem conexão',
};

const DOT: Record<SyncState, string> = {
  live: '#4ADE9B',
  reconnecting: dashboardPalette.amber,
  offline: '#FFB3B3',
};

// Selo de estado da sincronização para o cabeçalho de marca (texto claro
// sobre o coral): "Ao vivo" pulsando quando tudo chega em tempo real.
export function LiveBadge() {
  const { state } = useSyncStatus();
  return (
    <View style={styles.badge} accessibilityLabel={`Sincronização: ${LABEL[state]}`}>
      {state === 'live' ? (
        <PulseDot color={DOT.live} size={6} />
      ) : (
        <View style={[styles.dot, { backgroundColor: DOT[state] }]} />
      )}
      <Text style={styles.badgeText}>{LABEL[state]}</Text>
    </View>
  );
}

// Faixa no topo quando a conexão cai. Só aparece depois de alguns segundos
// para não piscar em quedas de meio segundo.
export function ConnectionBanner() {
  const { state } = useSyncStatus();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (state === 'live') {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), 2500);
    return () => clearTimeout(timer);
  }, [state]);

  if (!visible || state === 'live') return null;
  const offline = state === 'offline';
  return (
    <View pointerEvents="none" style={[styles.bannerWrap, { top: insets.top + 6 }]}>
      <View style={[styles.banner, offline ? styles.bannerOffline : styles.bannerReconnecting]}>
        <Ionicons name={offline ? 'cloud-offline-outline' : 'sync'} size={15} color={colors.white} />
        <Text style={styles.bannerText}>
          {offline ? 'Sem conexão — as telas não estão atualizando' : 'Reconectando… as telas podem estar desatualizadas'}
        </Text>
      </View>
    </View>
  );
}

const VISIBLE_MS = 3800;

// Aviso rápido de algo que outra pessoa fez ("Ana abriu a mesa 5").
export function LiveToasts() {
  const events = useLiveEvents();
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  const current = events[0];

  useEffect(() => {
    if (!current) return;
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() =>
        consumeLiveEvent(current.id)
      );
    }, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [current?.id, anim]);

  if (!current) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toastWrap,
        {
          top: insets.top + 10,
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
        },
      ]}
    >
      <View style={styles.toast}>
        <View style={styles.toastIcon}>
          <Ionicons name={current.icon} size={16} color={colors.white} />
        </View>
        <Text style={styles.toastText} numberOfLines={2}>
          {current.text}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderRadius: shape.full,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontFamily: font.bold, fontSize: 11, color: colors.white },
  bannerWrap: { position: 'absolute', left: 12, right: 12, alignItems: 'center', zIndex: 50 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: shape.full,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  bannerOffline: { backgroundColor: dashboardPalette.ink900 },
  bannerReconnecting: { backgroundColor: '#B45309' },
  bannerText: { fontFamily: font.semiBold, fontSize: 12.5, color: colors.white, flexShrink: 1 },
  toastWrap: { position: 'absolute', left: 14, right: 14, alignItems: 'center', zIndex: 60 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 420,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 16,
    borderRadius: 18,
    backgroundColor: dashboardPalette.ink900,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  toastIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: dashboardPalette.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: { fontFamily: font.semiBold, fontSize: 13.5, color: colors.white, flexShrink: 1 },
});
