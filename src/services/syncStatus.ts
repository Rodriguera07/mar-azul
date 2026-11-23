import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

// Estado da sincronização em tempo real, compartilhado pelo app inteiro.
// "live": recebendo atualizações; "reconnecting": uma escuta caiu e está sendo
// religada; "offline": sem rede (navegador offline ou dado só do cache).
export type SyncState = 'live' | 'reconnecting' | 'offline';

interface Snapshot {
  state: SyncState;
}

let snapshot: Snapshot = { state: 'live' };
const listeners = new Set<() => void>();
const failing = new Set<string>(); // escutas que estão em erro agora
let browserOffline = false;
let lastSyncAt: number | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

// Quanto tempo uma instabilidade precisa durar antes de aparecer na tela.
// No iPhone o Firestore alterna rapidamente entre "dado do cache" e "dado do
// servidor" (long polling, troca de rede, volta do segundo plano); mostrar cada
// oscilação fazia o selo/faixa de conexão trocar várias vezes por segundo.
const UNSTABLE_AFTER_MS = 4000;

function desired(): SyncState {
  return browserOffline ? 'offline' : failing.size > 0 ? 'reconnecting' : 'live';
}

function apply(state: SyncState) {
  if (state === snapshot.state) return;
  snapshot = { state };
  listeners.forEach((l) => l());
}

function recompute() {
  const target = desired();
  if (target === 'live' || target === 'offline') {
    // Voltar ao normal e "sem internet" valem na hora; só a instabilidade espera.
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
    apply(target);
    return;
  }
  if (snapshot.state === 'reconnecting' || pendingTimer) return;
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    apply(desired());
  }, UNSTABLE_AFTER_MS);
}

export function reportSyncOk(label: string, fromCache: boolean) {
  failing.delete(label);
  // Dado vindo só do cache local não conta como "sincronizado com o servidor".
  if (fromCache && !browserOffline) {
    failing.add(`${label}:cache`);
  } else {
    failing.delete(`${label}:cache`);
    lastSyncAt = Date.now();
  }
  recompute();
}

export function reportSyncError(label: string) {
  failing.add(label);
  recompute();
}

export function resetSyncStatus() {
  failing.clear();
  recompute();
}

export function getLastSyncAt(): number | null {
  return lastSyncAt;
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

// Usado só pelos testes (scripts/test-sync-status.ts).
export const __peek = (): SyncState => snapshot.state;
export const __subscribe = subscribe;
