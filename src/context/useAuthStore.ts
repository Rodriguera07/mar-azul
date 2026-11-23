import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
  type Unsubscribe,
} from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, setDoc, writeBatch } from 'firebase/firestore';
import { create } from 'zustand';
import { auth, db } from '../config/firebase';
import { usePosStore } from './usePosStore';
import { logAuditEvent } from '../services/auditLog';
import { countActiveAdmins, deleteOwnAccountData } from '../services/firestoreOrg';
import { UserProfile } from '../types';
import { withTimeout } from '../utils/timeout';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  user: UserProfile | null;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signUp: (input: {
    orgName: string;
    displayName: string;
    email: string;
    password: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ ok: boolean; error?: string }>;
  // Quantos admins ativos restariam na organização se a conta atual fosse
  // excluída agora — usado para alertar quem está prestes a excluir a
  // própria conta sendo o único admin.
  getRemainingAdminCount: () => Promise<number | null>;
  deleteAccount: (password: string) => Promise<{ ok: boolean; error?: string }>;
}

// Ponteiro global uid -> { orgId, role } em `users/{uid}`.
interface UserPointer {
  orgId: string;
  role: UserProfile['role'];
}

const READ_TIMEOUT_MS = 15000;

async function fetchPointer(uid: string): Promise<UserPointer | null> {
  const snap = await withTimeout(getDoc(doc(db, 'users', uid)), READ_TIMEOUT_MS);
  return snap.exists() ? (snap.data() as UserPointer) : null;
}

// Logo após o autocadastro, o onAuthStateChanged deste mesmo listener dispara
// antes de as escritas do ponteiro/perfil terminarem (a sessão já existe no
// Auth assim que a conta é criada, mas o Firestore ainda não). Sem repetir a
// busca, esse primeiro pointer nulo derrubava a sessão recém-criada.
async function fetchPointerWithRetry(
  uid: string,
  attempts = 5,
  delayMs = 400
): Promise<UserPointer | null> {
  for (let i = 0; i < attempts; i++) {
    const pointer = await fetchPointer(uid);
    if (pointer) return pointer;
    if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

async function fetchOrgProfile(orgId: string, uid: string): Promise<UserProfile | null> {
  const snap = await withTimeout(getDoc(doc(db, 'organizations', orgId, 'users', uid)), READ_TIMEOUT_MS);
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

function friendlyAuthError(code: string): string {
  switch (code) {
    case 'auth/invalid-email':
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'E-mail ou senha inválidos.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Aguarde um instante e tente novamente.';
    case 'auth/network-request-failed':
    case 'unavailable':
      return 'Sem conexão com a internet.';
    case 'timeout':
    case 'deadline-exceeded':
      return 'A conexão está lenta e o servidor não respondeu. Tente novamente.';
    default:
      return 'Não foi possível entrar. Tente novamente.';
  }
}

function friendlySignUpError(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Já existe uma conta com esse e-mail.';
    case 'auth/invalid-email':
      return 'E-mail inválido.';
    case 'auth/weak-password':
      return 'A senha precisa ter ao menos 6 caracteres.';
    case 'auth/network-request-failed':
      return 'Sem conexão com a internet.';
    default:
      return 'Não foi possível criar a conta. Tente novamente.';
  }
}

function friendlyChangePasswordError(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Senha atual incorreta.';
    case 'auth/weak-password':
      return 'A nova senha precisa ter ao menos 6 caracteres.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Aguarde um instante e tente novamente.';
    case 'auth/requires-recent-login':
      return 'Por segurança, saia e entre novamente antes de trocar a senha.';
    case 'auth/network-request-failed':
      return 'Sem conexão com a internet.';
    default:
      return 'Não foi possível trocar a senha. Tente novamente.';
  }
}

function friendlyDeleteAccountError(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Senha incorreta.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Aguarde um instante e tente novamente.';
    case 'auth/requires-recent-login':
      return 'Por segurança, saia e entre novamente antes de excluir a conta.';
    case 'auth/network-request-failed':
      return 'Sem conexão com a internet.';
    default:
      return 'Não foi possível excluir a conta. Tente novamente.';
  }
}

// Assinatura viva do perfil (org + role + active) do usuário logado, para que
// mudanças feitas por um admin (ex.: desativar a conta) se reflitam na hora.
let profileUnsubscribe: Unsubscribe | null = null;

function stopWatchingProfile() {
  profileUnsubscribe?.();
  profileUnsubscribe = null;
}

// Erros que significam "este usuário não pode mais ver o próprio perfil"
// (conta removida/desativada pelo admin). Qualquer outro erro é passageiro
// (rede caiu, iPhone voltou do segundo plano, token renovando).
const FATAL_PROFILE_ERRORS = new Set(['permission-denied', 'unauthenticated', 'not-found']);

function watchProfile(uid: string, orgId: string) {
  stopWatchingProfile();
  let cancelled = false;
  let inner: Unsubscribe | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;

  const start = () => {
    if (cancelled) return;
    inner = onSnapshot(
      doc(db, 'organizations', orgId, 'users', uid),
      (snap) => {
        attempt = 0;
        if (!snap.exists()) {
          stopWatchingProfile();
          useAuthStore.setState({ status: 'unauthenticated', user: null });
          return;
        }
        const profile = snap.data() as UserProfile;
        if (!profile.active) {
          stopWatchingProfile();
          signOut(auth);
          return;
        }
        useAuthStore.setState({ status: 'authenticated', user: profile });
      },
      (err: any) => {
        console.warn('[firestore] listener "profile" falhou', err);
        inner = null;
        const signedIn = useAuthStore.getState().status === 'authenticated';
        // Antes, QUALQUER erro aqui deslogava — no iPhone, que derruba a
        // conexão toda vez que o app vai para o segundo plano, isso jogava a
        // pessoa de volta no login no meio do atendimento. Agora só uma
        // falha de permissão encerra a sessão; o resto é religado sozinho.
        // Na primeira carga (ainda sem perfil), desiste depois de algumas
        // tentativas para não prender ninguém na tela de loading.
        if (FATAL_PROFILE_ERRORS.has(err?.code) || (!signedIn && attempt >= 3)) {
          stopWatchingProfile();
          useAuthStore.setState({ status: 'unauthenticated', user: null });
          return;
        }
        const delay = Math.min(15000, 1000 * 2 ** attempt);
        attempt += 1;
        timer = setTimeout(start, delay);
      }
    );
  };

  start();
  profileUnsubscribe = () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    inner?.();
    inner = null;
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  user: null,

  login: async (email, password) => {
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const pointer = await fetchPointer(credential.user.uid);
      if (!pointer) {
        await signOut(auth);
        return { ok: false, error: 'Usuário sem organização vinculada. Fale com o admin.' };
      }
      const profile = await fetchOrgProfile(pointer.orgId, credential.user.uid);
      if (!profile || !profile.active) {
        await signOut(auth);
        return { ok: false, error: 'Conta desativada. Fale com o admin.' };
      }
      // Entra direto com o perfil já lido, sem depender só do
      // onAuthStateChanged: se a abertura caiu no login por demora (ver
      // BOOT_TIMEOUT_MS), o Firebase pode já considerar a mesma conta logada
      // e não avisar de novo — e o app ficaria parado na tela de login.
      useAuthStore.setState({ status: 'authenticated', user: profile });
      watchProfile(profile.uid, profile.orgId);
      await logAuditEvent({
        orgId: profile.orgId,
        userId: profile.uid,
        userName: profile.displayName,
        type: 'login',
      });
      return { ok: true };
    } catch (err: any) {
      console.error('[auth] login falhou', err);
      return { ok: false, error: friendlyAuthError(err?.code ?? '') };
    }
  },

  // Autocadastro: cria a conta no Auth, uma organização nova e o perfil de
  // admin dela, tudo pelo próprio app (sem precisar de outro admin ou do
  // script de bootstrap manual). A escrita da org precisa terminar ANTES do
  // ponteiro/perfil, porque a regra de segurança do ponteiro confirma que a
  // org referenciada já existe e tem esse uid como dono.
  signUp: async ({ orgName, displayName, email, password }) => {
    try {
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const uid = credential.user.uid;
      await updateProfile(credential.user, { displayName: displayName.trim() });

      const nowIso = new Date().toISOString();
      const orgRef = doc(collection(db, 'organizations'));
      await setDoc(orgRef, { name: orgName.trim(), ownerId: uid, createdAt: nowIso });

      const batch = writeBatch(db);
      batch.set(doc(db, 'users', uid), { orgId: orgRef.id, role: 'admin' });
      batch.set(doc(db, 'organizations', orgRef.id, 'users', uid), {
        uid,
        orgId: orgRef.id,
        email: email.trim(),
        displayName: displayName.trim(),
        role: 'admin',
        active: true,
        createdAt: nowIso,
        createdBy: uid,
      });
      await batch.commit();

      await logAuditEvent({
        orgId: orgRef.id,
        userId: uid,
        userName: displayName.trim(),
        type: 'login',
      });
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: friendlySignUpError(err?.code ?? '') };
    }
  },

  logout: async () => {
    const { user } = get();
    if (user) {
      await logAuditEvent({
        orgId: user.orgId,
        userId: user.uid,
        userName: user.displayName,
        type: 'logout',
      });
    }
    profileUnsubscribe?.();
    profileUnsubscribe = null;
    usePosStore.getState().teardownOrgSync();
    await signOut(auth);
  },

  changePassword: async (currentPassword, newPassword) => {
    const { user } = get();
    const firebaseUser = auth.currentUser;
    if (!user || !firebaseUser) {
      return { ok: false, error: 'Sessão inválida. Entre novamente.' };
    }
    try {
      // updatePassword exige reautenticação recente; sem isso o Firebase
      // rejeita a troca com "auth/requires-recent-login" mesmo com sessão
      // ativa, então reautenticamos com a senha atual informada antes.
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(firebaseUser, credential);
      await updatePassword(firebaseUser, newPassword);
      await logAuditEvent({
        orgId: user.orgId,
        userId: user.uid,
        userName: user.displayName,
        type: 'password_changed',
      });
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: friendlyChangePasswordError(err?.code ?? '') };
    }
  },

  getRemainingAdminCount: async () => {
    const { user } = get();
    if (!user || user.role !== 'admin') return null;
    try {
      const total = await countActiveAdmins(user.orgId);
      return Math.max(0, total - 1);
    } catch {
      return null;
    }
  },

  // Exclusão de conta pelo próprio usuário: reautentica por segurança, apaga
  // o perfil da organização e o ponteiro global, registra o evento (antes de
  // apagar, enquanto o perfil ainda existe para a regra de auditoria) e por
  // último remove a conta do Firebase Auth.
  deleteAccount: async (password) => {
    const { user } = get();
    const firebaseUser = auth.currentUser;
    if (!user || !firebaseUser) {
      return { ok: false, error: 'Sessão inválida. Entre novamente.' };
    }
    let dataAlreadyDeleted = false;
    try {
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(firebaseUser, credential);

      await logAuditEvent({
        orgId: user.orgId,
        userId: user.uid,
        userName: user.displayName,
        type: 'account_deleted',
      });

      await deleteOwnAccountData(user.orgId, user.uid);
      dataAlreadyDeleted = true;

      profileUnsubscribe?.();
      profileUnsubscribe = null;
      usePosStore.getState().teardownOrgSync();

      await deleteUser(firebaseUser);
      return { ok: true };
    } catch (err: any) {
      // Se os dados da organização já foram apagados, o pedido de exclusão
      // foi cumprido — só a remoção da conta no Firebase Auth falhou (ex.:
      // queda de rede entre as duas chamadas). Não dá pra deixar a sessão
      // local "logada" apontando pra um perfil que não existe mais; força o
      // fim da sessão (sem ponteiro em `users/{uid}`, uma nova tentativa de
      // login já cai em signOut automático pelo listener de auth).
      if (dataAlreadyDeleted) {
        await signOut(auth).catch(() => {});
        set({ status: 'unauthenticated', user: null });
        return { ok: true };
      }
      return { ok: false, error: friendlyDeleteAccountError(err?.code ?? '') };
    }
  },
}));

// Restaura a sessão ao abrir o app e mantém org/role sincronizados enquanto
// o usuário estiver logado. Chamado uma única vez (ver App.tsx).
// Se a sessão não se resolver nesse tempo (banco local do navegador travado,
// rede presa), sai do loading e mostra o login em vez de girar para sempre. Se
// a sessão terminar de carregar depois, o app entra sozinho.
const BOOT_TIMEOUT_MS = 20000;

export function initAuthListener(): Unsubscribe {
  const bootTimer = setTimeout(() => {
    if (useAuthStore.getState().status === 'loading') {
      console.warn('[auth] sessão demorou demais para carregar; mostrando o login');
      useAuthStore.setState({ status: 'unauthenticated', user: null });
    }
  }, BOOT_TIMEOUT_MS);

  const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      profileUnsubscribe?.();
      profileUnsubscribe = null;
      useAuthStore.setState({ status: 'unauthenticated', user: null });
      return;
    }
    try {
      const pointer = await fetchPointerWithRetry(firebaseUser.uid);
      if (!pointer) {
        await signOut(auth);
        useAuthStore.setState({ status: 'unauthenticated', user: null });
        return;
      }
      watchProfile(firebaseUser.uid, pointer.orgId);
    } catch (err) {
      // Sem isso, um erro aqui (ex.: permissão negada, sem conexão) virava
      // uma rejeição de promise não tratada e deixava a sessão travada em
      // "loading" para sempre, sem cair de volta no login.
      console.warn('[auth] listener falhou ao buscar ponteiro do usuário', err);
      useAuthStore.setState({ status: 'unauthenticated', user: null });
    }
  });

  return () => {
    clearTimeout(bootTimer);
    unsubscribe();
  };
}
