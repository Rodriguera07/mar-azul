import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  inMemoryPersistence,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
  type Persistence,
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  memoryLocalCache,
  type Firestore,
} from 'firebase/firestore';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// `getReactNativePersistence` existe no build de React Native do SDK (usado em
// runtime graças à condição "react-native" configurada em metro.config.js),
// mas o mapa de "exports" do pacote resolve os *tipos* de "firebase/auth"
// sempre para o d.ts genérico, que não declara essa função exclusiva de RN.
// Por isso o acesso é feito via require + cast em vez de um import nomeado.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const getReactNativePersistence: (storage: unknown) => Persistence =
  require('firebase/auth').getReactNativePersistence;

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Endereço oficial do app na web (o projeto da Vercel com as chaves do
// Firebase configuradas).
const PRIMARY_WEB_HOST = 'trailer-mar-azul.vercel.app';

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  // Um segundo projeto na Vercel (quioque-app.vercel.app) publica o mesmo
  // código mas sem as chaves — quem abria por ele (inclusive o ícone salvo na
  // tela de início do iPhone) via o app quebrar na abertura. Em vez da tela de
  // erro, leva a pessoa para o endereço oficial, na mesma tela em que estava.
  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    window.location.hostname.endsWith('.vercel.app') &&
    window.location.hostname !== PRIMARY_WEB_HOST
  ) {
    window.location.replace(
      `https://${PRIMARY_WEB_HOST}${window.location.pathname}${window.location.search}${window.location.hash}`
    );
  }
  throw new Error(
    'Configuração do Firebase ausente. Copie .env.example para .env e preencha as chaves EXPO_PUBLIC_FIREBASE_*.'
  );
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// metro.config.js só força a condição "react-native" para o zustand — em
// todo o resto (incluindo o firebase/auth) a resolução por plataforma segue
// o padrão do Metro, então o web usa o build de browser do SDK e o nativo
// usa o build de React Native (que exige a persistência via AsyncStorage).
// No navegador (inclusive o app instalado no iPhone) o login é guardado no
// IndexedDB — e o Safari tem um histórico de falhas ali (banco travado ao voltar
// do segundo plano, armazenamento bloqueado). Sem alternativa, o login ficava
// preso ou nem abria. Com a lista de opções, o Firebase tenta uma por vez:
// IndexedDB, depois localStorage e, por último, a memória (a sessão vale até
// fechar o app, mas o app abre).
function createWebAuth(): Auth {
  try {
    return initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence],
    });
  } catch {
    // Já inicializado (ex.: recarga a quente) — reaproveita a instância.
    return getAuth(app);
  }
}

export const auth: Auth =
  Platform.OS === 'web'
    ? createWebAuth()
    : initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });

// Todo navegador de iPhone/iPad (Safari, Chrome, app instalado na tela de
// início) roda sobre o WebKit. Nele, o canal de streaming que o Firestore usa
// por padrão às vezes fica "pendurado" sem dar erro — principalmente depois
// de o app voltar do segundo plano ou trocar de Wi-Fi para 4G/5G. O sintoma é
// tela carregando para sempre (getDoc nunca responde) ou dados que param de
// atualizar. No iOS usamos long polling (requisições HTTP comuns), que é mais
// lento por alguns milissegundos mas não trava. iPadOS se apresenta como Mac,
// por isso a checagem extra de toque.
export const isAppleMobileWeb: boolean =
  Platform.OS === 'web' &&
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/i.test(navigator.userAgent || '') ||
    (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1));

export const db: Firestore = initializeFirestore(app, {
  localCache: Platform.OS === 'web' ? memoryLocalCache() : persistentLocalCache(),
  // O app usa `campo?: string` (undefined) para "sem valor" em vários tipos
  // (ex.: Table.waiterName) — sem isso, gravar esses objetos direto lança
  // "Unsupported field value: undefined".
  ignoreUndefinedProperties: true,
  // Safari/iPhone, redes com bloqueador de conteúdo, VPN ou Relay Privado do
  // iCloud costumam barrar o canal em tempo real (WebChannel) do Firestore, e
  // o app ficava sem receber dados. Com isto o SDK testa a conexão e, se o
  // canal normal falhar, muda sozinho para o modo compatível (long polling).
  // No iPhone/iPad vai direto para o long polling (o canal normal às vezes
  // trava sem falhar, e aí a detecção automática não percebe). As duas opções
  // NÃO podem ser ligadas juntas — o Firestore recusa a configuração.
  ...(isAppleMobileWeb
    ? { experimentalForceLongPolling: true, experimentalAutoDetectLongPolling: false }
    : Platform.OS === 'web'
      ? { experimentalAutoDetectLongPolling: true }
      : {}),
});

export { app, firebaseConfig };
