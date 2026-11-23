import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

// Estado da sincronização em tempo real, compartilhado pelo app inteiro.
// "live": recebendo atualizações; "reconnecting": uma escuta caiu e está sendo
// religada; "offline": sem rede (navegador offline ou dado só do cache).
export type SyncState = 'live' | 'reconnecting' | 'offline';

interface Snapshot {
  state: SyncState;
  lastSyncAt: number | null;
}

let snapshot: Snapshot = { state: 'live', lastSyncAt: null };
const listeners = new Set<() => void>();
const failing = new Set<string>(); // escutas que estão em erro agora
let browserOffline = false;

function recompute(lastSyncAt?: number) {
  const state: SyncState = browserOffline ? 'offline' : failing.size > 0 ? 'reconnecting' : 'live';
  const next = {
    state,
    lastSyncAt: lastSyncAt ?? snapshot.lastSyncAt,
  };
  if (next.state === snapshot.state && next.lastSyncAt === snapshot.lastSyncAt) return;
  snapshot = next;
  listeners.forEach((l) => l());
}

export function reportSyncOk(label: string, fromCache: boolean) {
  failing.delete(label);
  // Dado vindo só do cache local não conta como "sincronizado com o servidor".
  if (fromCache && !browserOffline) {
    failing.add(`${label}:cache`);
  } else {
    failing.delete(`${label}:cache`);
  }
  recompute(fromCache ? undefined : Date.now());
}

export function reportSyncError(label: string) {
  failing.add(label);
  recompute();
}

export function resetSyncStatus() {
  failing.clear();
  recompute();
}

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  browserOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
  window.addEventListener('offline', () => {
    browserOffline = true;
    recompute();
  });
  window.addEventListener('online', () => {
    browserOffline = false;
    recompute();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSyncStatus(): Snapshot {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}
