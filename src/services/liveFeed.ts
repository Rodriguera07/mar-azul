import { useSyncExternalStore } from 'react';

// Avisos "de quem está usando junto": mesas abertas, fechadas ou alteradas em
// outro aparelho. Fila simples com assinatura externa (sem dependência de
// store do app, para o serviço de sincronização poder publicar daqui).
export interface LiveEvent {
  id: string;
  icon: 'add-circle' | 'checkmark-circle' | 'sync';
  text: string;
}

let queue: LiveEvent[] = [];
const listeners = new Set<() => void>();
let counter = 0;

export function pushLiveEvent(event: Omit<LiveEvent, 'id'>) {
  counter += 1;
  queue = [...queue, { ...event, id: `live-${Date.now()}-${counter}` }].slice(-6);
  listeners.forEach((l) => l());
}

export function consumeLiveEvent(id: string) {
  queue = queue.filter((e) => e.id !== id);
  listeners.forEach((l) => l());
}

export function clearLiveEvents() {
  queue = [];
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useLiveEvents(): LiveEvent[] {
  return useSyncExternalStore(subscribe, () => queue, () => queue);
}

export function getLiveEvents(): LiveEvent[] {
  return queue;
}
