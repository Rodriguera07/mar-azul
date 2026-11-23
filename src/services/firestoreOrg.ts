import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type Query,
  type QuerySnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  AuditLogEntry,
  ClosedSale,
  MenuItemInput,
  OrderItem,
  PaymentMethod,
  SplitPayment,
  Table,
  UserProfile,
  WebPushSubscription,
} from '../types';
import { computeNextPaymentAmount, computeTotals, isPaidInFull } from '../utils/billing';
import { asNumber, sanitizeClosedSale, sanitizeMenuItems, sanitizeTable } from '../utils/sanitize';
import { reportSyncError, reportSyncOk } from './syncStatus';

const tablesCol = (orgId: string) => collection(db, 'organizations', orgId, 'tables');
const closedSalesCol = (orgId: string) => collection(db, 'organizations', orgId, 'closedSales');
const orgUsersCol = (orgId: string) => collection(db, 'organizations', orgId, 'users');
const auditLogCol = (orgId: string) => collection(db, 'organizations', orgId, 'auditLog');
const daySummaryDoc = (orgId: string, date: string) =>
  doc(db, 'organizations', orgId, 'daySummaries', date);
const menuDoc = (orgId: string) => doc(db, 'organizations', orgId, 'config', 'menu');

// Um listener do Firestore que dá erro (rede instável, token renovando,
// permissão momentânea) é ENCERRADO pelo SDK — sem religar, a tela para de
// receber atualizações e só volta recarregando o app. Este wrapper religa a
// escuta sozinho, com espera crescente (1s, 2s, 4s… até 15s), e informa o
// estado da conexão para o app mostrar "Reconectando…" em vez de ficar parado
// sem avisar.
type Target = Query<DocumentData> | DocumentReference<DocumentData>;

export function liveSnapshot(
  label: string,
  target: Target,
  onNext: (snap: any) => void,
  options: { trackCache?: boolean } = {}
): Unsubscribe {
  let unsubscribe: Unsubscribe | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  let cancelled = false;

  const start = () => {
    if (cancelled) return;
    unsubscribe = onSnapshot(
      target as any,
      // Metadados só na escuta que alimenta o indicador de conexão: ela avisa
      // quando o dado passa a vir do servidor de novo (fromCache -> false).
      { includeMetadataChanges: options.trackCache === true },
      (snap: QuerySnapshot<DocumentData> | DocumentSnapshot<DocumentData>) => {
        attempt = 0;
        reportSyncOk(label, options.trackCache === true && snap.metadata.fromCache);
        onNext(snap);
      },
      (err: unknown) => {
        console.warn(`[firestore] listener "${label}" falhou, religando…`, err);
        reportSyncError(label);
        unsubscribe?.();
        unsubscribe = null;
        const delay = Math.min(15000, 1000 * 2 ** attempt);
        attempt += 1;
        timer = setTimeout(start, delay);
      }
    );
  };

  start();
  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    unsubscribe?.();
  };
}

function liveQuery(
  label: string,
  query: Query<DocumentData>,
  onNext: (snap: QuerySnapshot<DocumentData>) => void,
  options?: { trackCache?: boolean }
): Unsubscribe {
  return liveSnapshot(label, query, onNext, options);
}

function liveDoc(
  label: string,
  ref: DocumentReference<DocumentData>,
  onNext: (snap: DocumentSnapshot<DocumentData>) => void
): Unsubscribe {
  return liveSnapshot(label, ref, onNext);
}

export type MutateItemsResult = 'ok' | 'not-found' | 'not-open';

// Altera os itens de uma mesa DENTRO de uma transação: lê a versão mais nova
// do documento, aplica a mudança sobre ela e grava. Antes, cada aparelho
// gravava a lista de itens inteira calculada a partir do que tinha em tela —
// dois garçons lançando itens na mesma mesa ao mesmo tempo se sobrescreviam e
// um dos pedidos sumia. Com a transação, as duas mudanças se somam.
export function mutateTableItems(
  orgId: string,
  tableId: string,
  mutate: (items: OrderItem[]) => OrderItem[]
): Promise<MutateItemsResult> {
  const ref = doc(tablesCol(orgId), tableId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return 'not-found' as const;
    const table = sanitizeTable(snap.id, snap.data());
    if (table.status !== 'open') return 'not-open' as const;
    tx.update(ref, { items: mutate(table.items) });
    return 'ok' as const;
  });
}

export function newTableId(orgId: string): string {
  return doc(tablesCol(orgId)).id;
}

export function setTable(orgId: string, table: Table): Promise<void> {
  return setDoc(doc(tablesCol(orgId), table.id), table);
}

export function updateTable(orgId: string, tableId: string, patch: Partial<Table>): Promise<void> {
  return updateDoc(doc(tablesCol(orgId), tableId), patch);
}

export interface RecordPaymentResult {
  status: 'ok' | 'already-paid' | 'not-found';
  amount: number;
  fullyPaid: boolean;
}

// Transação (não um updateDoc otimista) porque `payments` é lido e
// recalculado a partir do documento fresco no servidor — sem isso, dois
// pagamentos quase simultâneos (dois garçons cobrando a mesma mesa dividida)
// cada um escreveria `payments: [...snapshotLocalDesatualizado, novoPagamento]`,
// e o segundo `updateDoc` a chegar no servidor apagaria silenciosamente o
// pagamento do primeiro.
export async function recordPaymentTransaction(
  orgId: string,
  tableId: string,
  payment: { id: string; method: PaymentMethod; paidAt: string }
): Promise<RecordPaymentResult> {
  const tableRef = doc(tablesCol(orgId), tableId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(tableRef);
    if (!snap.exists()) return { status: 'not-found' as const, amount: 0, fullyPaid: false };

    const table = sanitizeTable(snap.id, snap.data());
    const amount = computeNextPaymentAmount(table);
    if (amount <= 0) {
      return { status: 'already-paid' as const, amount: 0, fullyPaid: isPaidInFull(table) };
    }

    const fullPayment: SplitPayment = { ...payment, amount };
    const payments = [...table.payments, fullPayment];
    tx.update(tableRef, { payments });
    return { status: 'ok' as const, amount, fullyPaid: isPaidInFull({ ...table, payments }) };
  });
}

export function subscribeTables(orgId: string, cb: (tables: Table[]) => void): Unsubscribe {
  // Reaproveita a referência de objeto das mesas que não mudaram neste
  // evento (via `docChanges()`, em vez de `snap.docs.map(d => d.data())`
  // puro). Sem isso, `.data()` cria um objeto novo pra TODA mesa a cada
  // snapshot — mesmo pra quem não mudou nada — e telas que leem uma mesa
  // específica com `tables.find(...)` (TableDetail, AddItems, CloseTable)
  // re-renderizavam toda vez que QUALQUER outra mesa da organização mudava,
  // porque o Zustand via um valor "novo" por comparação referencial.
  let byId = new Map<string, Table>();
  let first = true;
  return liveQuery(
    'tables',
    tablesCol(orgId),
    (snap) => {
      const changes = snap.docChanges();
      // Snapshot só de metadados (ex.: cache -> servidor) não muda nenhuma mesa:
      // só atualiza o indicador de conexão, sem re-renderizar as telas.
      if (!first && changes.length === 0) return;
      first = false;
      const next = new Map(byId);
      for (const change of changes) {
        if (change.type === 'removed') next.delete(change.doc.id);
        else next.set(change.doc.id, sanitizeTable(change.doc.id, change.doc.data()));
      }
      byId = next;
      cb(snap.docs.map((d) => next.get(d.id) ?? sanitizeTable(d.id, d.data())));
    },
    { trackCache: true }
  );
}

export function subscribeClosedSalesSince(
  orgId: string,
  sinceIso: string,
  cb: (sales: ClosedSale[]) => void
): Unsubscribe {
  const q = query(
    closedSalesCol(orgId),
    where('closedAt', '>=', sinceIso),
    orderBy('closedAt', 'desc')
  );
  return liveQuery('closedSalesSince', q, (snap) => cb(snap.docs.map((d) => sanitizeClosedSale(d.id, d.data()))));
}

// Leitura única e direta do servidor (sem depender do listener local, que
// pode estar alguns instantes atrasado num outro dispositivo) — usada no
// encerramento do dia para não computar o faturamento com uma foto
// desatualizada e "perder" pra sempre uma venda fechada bem na hora do corte.
export async function getClosedSalesSince(orgId: string, sinceIso: string): Promise<ClosedSale[]> {
  const q = query(closedSalesCol(orgId), where('closedAt', '>=', sinceIso), orderBy('closedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => sanitizeClosedSale(d.id, d.data()));
}

export function subscribeClosedSalesRange(
  orgId: string,
  fromIso: string,
  toIso: string,
  cb: (sales: ClosedSale[]) => void
): Unsubscribe {
  const q = query(
    closedSalesCol(orgId),
    where('closedAt', '>=', fromIso),
    where('closedAt', '<=', toIso),
    orderBy('closedAt', 'desc')
  );
  return liveQuery('closedSalesRange', q, (snap) => cb(snap.docs.map((d) => sanitizeClosedSale(d.id, d.data()))));
}

export type CloseTableResult = 'ok' | 'not-open' | 'not-found' | 'unpaid';

// Fecha a mesa dentro de uma transação: revalida no servidor que ela ainda
// está aberta e está totalmente paga antes de gravar (mesas sem nenhum item
// já estão "pagas" por não terem valor a cobrar) — evita que dois
// dispositivos fechem a mesma mesa duas vezes caso ambos estivessem offline
// e reconectem quase ao mesmo tempo.
export async function closeTableTransaction(
  orgId: string,
  tableId: string,
  saleId: string,
  closedBy: { userId: string; userName: string }
): Promise<CloseTableResult> {
  const tableRef = doc(tablesCol(orgId), tableId);
  const saleRef = doc(closedSalesCol(orgId), saleId);

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(tableRef);
    if (!snap.exists()) return 'not-found';
    const table = sanitizeTable(snap.id, snap.data());
    if (table.status !== 'open') return 'not-open';
    if (!isPaidInFull(table)) return 'unpaid';

    const { subtotal, serviceFeeAmount, total } = computeTotals(
      table.items,
      table.serviceFeeEnabled
    );
    const closedAt = new Date().toISOString();

    const sale: ClosedSale = {
      id: saleId,
      tableLabel: table.label,
      waiterName: table.waiterName,
      items: table.items,
      subtotal,
      serviceFeeAmount,
      total,
      payments: table.payments,
      openedAt: table.openedAt,
      closedAt,
      openedByUserId: table.openedByUserId,
      openedByUserName: table.openedByUserName,
      closedByUserId: closedBy.userId,
      closedByUserName: closedBy.userName,
    };

    tx.set(saleRef, sale);
    tx.update(tableRef, {
      status: 'closed',
      closedAt,
      subtotal,
      serviceFeeAmount,
      total,
      closedByUserId: closedBy.userId,
      closedByUserName: closedBy.userName,
    });
    return 'ok';
  });
}

interface DaySummaryRollup {
  date: string;
  totalRevenue: number;
  paymentBreakdown: Record<PaymentMethod, number>;
  closedAt: string;
}

// Rollup do dia anterior (gravado no encerramento de dia), usado só para
// comparar o faturamento de hoje com o de ontem no Painel. Se o dia anterior
// nunca foi encerrado (primeiro dia de uso, por exemplo), não existe rollup
// e a comparação simplesmente não aparece — não fabricamos um valor.
export async function getDaySummary(orgId: string, date: string): Promise<DaySummaryRollup | null> {
  const snap = await getDoc(daySummaryDoc(orgId, date));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    date: String(data.date ?? date),
    totalRevenue: asNumber(data.totalRevenue),
    paymentBreakdown: {
      pix: asNumber(data.paymentBreakdown?.pix),
      dinheiro: asNumber(data.paymentBreakdown?.dinheiro),
      debito: asNumber(data.paymentBreakdown?.debito),
      credito: asNumber(data.paymentBreakdown?.credito),
    },
    closedAt: String(data.closedAt ?? ''),
  };
}

// Zera o quadro do dia (apaga as mesas já fechadas) e grava o rollup usado
// pelos Relatórios. As vendas em si (`closedSales`) nunca são tocadas aqui —
// são o histórico permanente que sobrevive ao fim do dia.
export async function clearClosedTablesAndSummarize(
  orgId: string,
  rollup: DaySummaryRollup
): Promise<void> {
  const closedSnap = await getDocs(query(tablesCol(orgId), where('status', '==', 'closed')));
  const batch = writeBatch(db);
  closedSnap.docs.forEach((d) => batch.delete(d.ref));
  batch.set(daySummaryDoc(orgId, rollup.date), rollup);
  await batch.commit();
}

export function subscribeOrgUsers(orgId: string, cb: (users: UserProfile[]) => void): Unsubscribe {
  return liveQuery('orgUsers', orgUsersCol(orgId), (snap) => cb(snap.docs.map((d) => d.data() as UserProfile)));
}

export function setOrgUserActive(orgId: string, uid: string, active: boolean): Promise<void> {
  return updateDoc(doc(orgUsersCol(orgId), uid), { active });
}

export function setUserPushToken(orgId: string, uid: string, expoPushToken: string): Promise<void> {
  return updateDoc(doc(orgUsersCol(orgId), uid), { expoPushToken });
}

// Assinatura de Web Push (endpoint + chaves) do navegador do usuário. O
// envio em si é feito pela função serverless (precisa da VAPID private key,
// que nunca pode ir pro cliente), por isso não há um "getAdminWebPush..."
// aqui — quem lê essa fatia é a função, via Admin SDK.
export function setUserWebPushSubscription(
  orgId: string,
  uid: string,
  webPushSubscription: WebPushSubscription
): Promise<void> {
  return updateDoc(doc(orgUsersCol(orgId), uid), { webPushSubscription });
}

// Tokens de todos os admins ativos da org. Inclui propositalmente quem
// disparou a ação: numa organização pequena o admin frequentemente também
// opera o caixa, e excluí-lo fazia a notificação nunca sair quando ele era o
// único admin cadastrado.
export async function getAdminPushTokens(orgId: string): Promise<string[]> {
  const q = query(orgUsersCol(orgId), where('role', '==', 'admin'), where('active', '==', true));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => d.data() as UserProfile)
    .filter((u) => !!u.expoPushToken)
    .map((u) => u.expoPushToken as string);
}

// Quantos admins ativos a organização tem — usado para avisar um admin que
// está prestes a excluir a própria conta e ficaria sem ninguém para gerenciar
// usuários/relatórios depois.
export async function countActiveAdmins(orgId: string): Promise<number> {
  const q = query(orgUsersCol(orgId), where('role', '==', 'admin'), where('active', '==', true));
  const snap = await getDocs(q);
  return snap.size;
}

// Exclusão de conta pelo próprio usuário (LGPD, direito de eliminação):
// remove o perfil da organização e o ponteiro global uid -> org/role. O
// registro de vendas/mesas fechadas em que ele aparece como autor NÃO é
// apagado — é histórico financeiro do estabelecimento, mantido conforme a
// Política de Privacidade.
export function deleteOwnAccountData(orgId: string, uid: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(orgUsersCol(orgId), uid));
  batch.delete(doc(db, 'users', uid));
  return batch.commit();
}

// Cardápio: um único documento com a lista inteira, em vez de uma
// subcoleção por item — a tela de gestão edita tudo localmente e grava de
// uma vez só no "Salvar Cardápio", então não há motivo pra granularidade de
// um doc por item. `null` significa "organização ainda não salvou o próprio
// cardápio" (mostra o catálogo padrão local até o primeiro salvamento).
export function subscribeMenu(
  orgId: string,
  cb: (items: MenuItemInput[] | null) => void
): Unsubscribe {
  return liveDoc('menu', menuDoc(orgId), (snap) => cb(snap.exists() ? sanitizeMenuItems(snap.data().items) : null));
}

export function saveMenu(orgId: string, items: MenuItemInput[]): Promise<void> {
  return setDoc(menuDoc(orgId), { items, updatedAt: new Date().toISOString() });
}

export function subscribeAuditLog(
  orgId: string,
  pageSize: number,
  cb: (entries: AuditLogEntry[]) => void
): Unsubscribe {
  const q = query(auditLogCol(orgId), orderBy('timestamp', 'desc'), limit(pageSize));
  return liveQuery('auditLog', q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLogEntry))));
}
