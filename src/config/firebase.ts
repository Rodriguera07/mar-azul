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

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
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
  ...(Platform.OS === 'web' ? { experimentalAutoDetectLongPolling: true } : {}),
});

export { app, firebaseConfig };
