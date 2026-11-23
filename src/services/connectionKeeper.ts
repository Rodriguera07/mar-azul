import { disableNetwork, enableNetwork } from 'firebase/firestore';
import { Platform } from 'react-native';
import { db } from '../config/firebase';

// O iPhone congela o app (aba ou ícone na tela de início) assim que ele sai da
// frente, e a conexão com o Firestore morre junto — mas sem nenhum erro. Ao
// voltar, o SDK ainda acha que está conectado e leva muito tempo (às vezes
// nunca) para perceber: a tela fica carregando ou com dados velhos até alguém
// recarregar o app. Aqui forçamos uma reconexão limpa sempre que o app volta
// depois de um tempo fora, quando a rede volta ou quando o Safari restaura a
// página da memória (bfcache). As escutas ativas continuam valendo e recebem
// os dados novos sozinhas; gravações pendentes ficam na fila e são enviadas.

const RECONNECT_AFTER_HIDDEN_MS = 15 * 1000;

let started = false;
let reconnecting: Promise<void> | null = null;

function reconnect(): Promise<void> {
  if (reconnecting) return reconnecting;
  reconnecting = disableNetwork(db)
    .catch(() => {})
    .then(() => enableNetwork(db))
    .catch((err) => console.warn('[firestore] falha ao reconectar', err))
    .finally(() => {
      reconnecting = null;
    });
  return reconnecting;
}

export function startConnectionKeeper(): void {
  if (started || Platform.OS !== 'web' || typeof document === 'undefined') return;
  started = true;

  let hiddenAt: number | null = document.visibilityState === 'hidden' ? Date.now() : null;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      return;
    }
    const away = hiddenAt !== null ? Date.now() - hiddenAt : 0;
    hiddenAt = null;
    if (away >= RECONNECT_AFTER_HIDDEN_MS) reconnect();
  });

  window.addEventListener('online', () => {
    reconnect();
  });

  window.addEventListener('pageshow', (event) => {
    if ((event as PageTransitionEvent).persisted) reconnect();
  });
}
