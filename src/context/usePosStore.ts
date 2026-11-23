import { create } from 'zustand';
import { clearLiveEvents, pushLiveEvent } from '../services/liveFeed';
import { resetSyncStatus } from '../services/syncStatus';
import { DEFAULT_IMAGE_BY_ID, DEFAULT_MENU_ITEMS, normalizePortionItems, sortMenuItems } from '../data/menu';
import {
  clearClosedTablesAndSummarize,
  closeTableTransaction,
  getClosedSalesSince,
  getDaySummary,
  newTableId,
  recordPaymentTransaction,
  saveMenu,
  subscribeClosedSalesSince,
  subscribeMenu,
  subscribeTables,
  updateTable,
  setTable,
  type CloseTableResult,
  mutateTableItems,
} from '../services/firestoreOrg';
import { logAuditEvent } from '../services/auditLog';
import { notifyAdmins } from '../services/notifications';
import {
  ClosedSale,
  DaySummary,
  MenuItem,
  MenuItemInput,
  OrderItem,
  PaymentMethod,
  SplitPayment,
  Table,
} from '../types';
import {
  MAX_SPLIT_COUNT,
  MIN_SPLIT_COUNT,
  PAID_EPSILON,
  computeNextPaymentAmount,
  computeTotals,
  round2,
} from '../utils/billing';
import { formatDateKey } from '../utils/format';
import { generateId } from '../utils/id';
import { showAlert } from '../utils/alert';
import type { Unsubscribe } from 'firebase/firestore';

// Escritas "dispare e esqueça" (não aguardadas pela UI) falhavam em
// silêncio — o usuário via a mudança sumir sem explicação quando o listener
// do Firestore revertia o valor otimista. Isso garante um aviso mínimo.
function warnAndAlert(context: string, title: string) {
  return (err: unknown) => {
    console.warn(`[usePosStore] ${context}`, err);
    showAlert(title, 'Verifique sua conexão e tente novamente.');
  };
}

interface CurrentUser {
  uid: string;
  displayName: string;
}

interface PosState {
  tables: Table[];
  closedSalesToday: ClosedSale[];
  // Início (ISO) da janela de "vendas de hoje" atualmente assinada — usado
  // pelo endDay para reler o Firestore direto do servidor nesse mesmo
  // recorte, em vez de confiar só na foto local do listener.
  salesWindowStart: string | null;
  menuItems: MenuItem[];
  currentDay: string;
  orgId: string | null;
  currentUser: CurrentUser | null;

  initOrgSync: (orgId: string, user: CurrentUser, options?: { liveToasts?: boolean }) => void;
  teardownOrgSync: () => void;
  saveMenuItems: (items: MenuItemInput[]) => Promise<boolean>;

  openTable: (label: string, waiterName?: string) => string;
  renameTable: (tableId: string, label: string) => void;
  addItem: (tableId: string, menuItem: MenuItem, quantity?: number) => void;
  incrementItem: (tableId: string, orderItemId: string) => void;
  decrementItem: (tableId: string, orderItemId: string) => void;
  removeItem: (tableId: string, orderItemId: string) => void;
  toggleServiceFee: (tableId: string) => void;
  toggleSplit: (tableId: string) => void;
  setSplitCount: (tableId: string, count: number) => void;
  recordPayment: (tableId: string, method: PaymentMethod) => Promise<{ ok: boolean; fullyPaid: boolean }>;
  closeTable: (tableId: string) => Promise<CloseTableResult>;
  endDay: () => Promise<DaySummary | null>;
}

// Enche `image` (require() de asset local) a partir do catálogo padrão, por
// id — itens do Firestore nunca carregam imagem própria (ver MenuItemInput).
function hydrateMenu(items: MenuItemInput[]): MenuItem[] {
  return sortMenuItems(
    normalizePortionItems(items).map((item) => ({ ...item, image: DEFAULT_IMAGE_BY_ID[item.id] }))
  );
}

// Aplica os itens localmente antes de disparar a escrita no Firestore (que
// só volta pelo listener de `subscribeTables` depois de um round-trip). Sem
// isso, dois toques rápidos no +/- de um item (garçom apressado) leem o
// mesmo `tables` desatualizado e cada um escreve "quantidade + 1" a partir do
// mesmo valor antigo — um dos incrementos some silenciosamente.
function withItems(tables: Table[], tableId: string, items: OrderItem[]): Table[] {
  return tables.map((t) => (t.id === tableId ? { ...t, items } : t));
}

// Mesas com gravação de itens em andamento: enquanto houver, a versão local
// dos itens vale (o servidor responde depois do toque, e aplicar a resposta
// "atrasada" faria a quantidade piscar para trás entre dois toques rápidos).
const pendingOps = new Map<string, number>();
let lastRemote: Table[] = [];

function mergeRemote(remote: Table[], local: Table[]): Table[] {
  return remote.map((t) => {
    if ((pendingOps.get(t.id) ?? 0) === 0) return t;
    const localTable = local.find((l) => l.id === t.id);
    return localTable ? { ...t, items: localTable.items } : t;
  });
}

function itemsSignature(table: Table): string {
  return table.items.map((i) => `${i.id}:${i.quantity}`).join('|');
}

// Compara o que chegou do servidor com o que já está em tela e avisa sobre o
// que OUTRA pessoa fez (mesa aberta, fechada ou com pedido alterado). Mudanças
// feitas neste aparelho já estão no estado local e por isso não aparecem aqui.
function announceRemoteChanges(prev: Table[], next: Table[], myUid: string) {
  const prevById = new Map(prev.map((t) => [t.id, t]));
  for (const table of next) {
    const before = prevById.get(table.id);
    if (!before) {
      if (table.status === 'open' && table.openedByUserId !== myUid) {
        pushLiveEvent({
          icon: 'add-circle',
          text: `${table.openedByUserName ?? 'Alguém'} abriu a mesa ${table.label}`,
        });
      }
      continue;
    }
    if (before.status === 'open' && table.status === 'closed') {
      pushLiveEvent({ icon: 'checkmark-circle', text: `Mesa ${table.label} foi fechada` });
    } else if (table.status === 'open' && itemsSignature(before) !== itemsSignature(table)) {
      pushLiveEvent({ icon: 'sync', text: `Pedido da mesa ${table.label} foi atualizado` });
    }
  }
}

// Grava a mudança de itens no servidor somando-a à versão mais recente da mesa
// (transação). Se a transação não puder rodar por falta de conexão, cai para a
// gravação direta da lista já calculada localmente (que o Firestore enfileira
// e envia ao reconectar) — o mesmo comportamento de antes, só que sem perder
// pedidos de outro aparelho quando há rede.
function commitItems(
  orgId: string,
  tableId: string,
  mutate: (items: OrderItem[]) => OrderItem[],
  optimistic: OrderItem[],
  failMessage: string
) {
  pendingOps.set(tableId, (pendingOps.get(tableId) ?? 0) + 1);
  mutateTableItems(orgId, tableId, mutate)
    .catch((err: any) => {
      if (err?.code === 'unavailable') {
        updateTable(orgId, tableId, { items: optimistic }).catch(
          warnAndAlert('atualizar itens', failMessage)
        );
        return;
      }
      warnAndAlert('atualizar itens', failMessage)(err);
    })
    .finally(() => {
      const left = (pendingOps.get(tableId) ?? 1) - 1;
      if (left > 0) {
        pendingOps.set(tableId, left);
        return;
      }
      pendingOps.delete(tableId);
      // Última gravação da mesa terminou: assume a versão do servidor, que já
      // inclui o que outras pessoas lançaram no meio tempo.
      const state = usePosStore.getState();
      if (lastRemote.some((t) => t.id === tableId)) {
        usePosStore.setState({ tables: mergeRemote(lastRemote, state.tables) });
      }
    });
}

let tablesUnsubscribe: Unsubscribe | null = null;
let closedSalesUnsubscribe: Unsubscribe | null = null;
let menuUnsubscribe: Unsubscribe | null = null;

export const usePosStore = create<PosState>((set, get) => ({
  tables: [],
  closedSalesToday: [],
  salesWindowStart: null,
  menuItems: DEFAULT_MENU_ITEMS,
  currentDay: formatDateKey(),
  orgId: null,
  currentUser: null,

  initOrgSync: (orgId, user, options) => {
    tablesUnsubscribe?.();
    closedSalesUnsubscribe?.();
    menuUnsubscribe?.();

    set({ orgId, currentUser: user, currentDay: formatDateKey() });

    lastRemote = [];
    pendingOps.clear();
    let firstTablesSnapshot = true;
    tablesUnsubscribe = subscribeTables(orgId, (remote) => {
      lastRemote = remote;
      const local = get().tables;
      const merged = mergeRemote(remote, local);
      // A primeira leitura é o estado atual (histórico), não novidade.
      if (!firstTablesSnapshot && options?.liveToasts) announceRemoteChanges(local, merged, user.uid);
      firstTablesSnapshot = false;
      set({ tables: merged });
    });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Se o dia já foi encerrado antes nesta mesma data (em qualquer sessão
    // ou dispositivo), o corte de "vendas de hoje" precisa começar depois
    // desse fechamento, não da meia-noite — senão, ao sair e entrar de novo
    // no mesmo dia, as vendas já encerradas voltam a aparecer como se o dia
    // nunca tivesse sido fechado.
    getDaySummary(orgId, formatDateKey()).then((rollup) => {
      // A org pode ter trocado (novo login) enquanto essa leitura estava em
      // andamento — nesse caso, quem já reiniciou a sincronização por último
      // é quem deve vencer.
      if (get().orgId !== orgId) return;
      const since =
        rollup && rollup.closedAt > startOfToday.toISOString()
          ? rollup.closedAt
          : startOfToday.toISOString();
      set({ salesWindowStart: since });
      closedSalesUnsubscribe = subscribeClosedSalesSince(orgId, since, (closedSalesToday) =>
        set({ closedSalesToday })
      );
    });

    menuUnsubscribe = subscribeMenu(orgId, (items) => {
      set({ menuItems: items ? hydrateMenu(items) : DEFAULT_MENU_ITEMS });
    });
  },

  teardownOrgSync: () => {
    lastRemote = [];
    pendingOps.clear();
    clearLiveEvents();
    resetSyncStatus();
    tablesUnsubscribe?.();
    closedSalesUnsubscribe?.();
    menuUnsubscribe?.();
    tablesUnsubscribe = null;
    closedSalesUnsubscribe = null;
    menuUnsubscribe = null;
    set({
      tables: [],
      closedSalesToday: [],
      salesWindowStart: null,
      menuItems: DEFAULT_MENU_ITEMS,
      orgId: null,
      currentUser: null,
    });
  },

  saveMenuItems: async (items) => {
    const { orgId, currentUser } = get();
    if (!orgId) return false;
    try {
      await saveMenu(orgId, items);
      if (currentUser) {
        logAuditEvent({
          orgId,
          userId: currentUser.uid,
          userName: currentUser.displayName,
          type: 'menu_updated',
        });
      }
      return true;
    } catch (err) {
      console.warn('[usePosStore] salvar cardápio', err);
      return false;
    }
  },

  openTable: (label, waiterName) => {
    const { orgId, currentUser, tables } = get();
    if (!orgId || !currentUser) return '';

    const trimmedLabel = label.trim();
    // A tela já bloqueia e avisa o usuário antes de chegar aqui — este é só
    // um guard silencioso contra chamadas concorrentes (ex.: duplo toque no
    // botão "Abrir Mesa" antes do primeiro clique navegar para longe da tela).
    const duplicate = tables.some(
      (t) => t.status === 'open' && t.label.trim().toLowerCase() === trimmedLabel.toLowerCase()
    );
    if (duplicate) return '';

    const id = newTableId(orgId);
    const newTable: Table = {
      id,
      label: trimmedLabel,
      waiterName: waiterName?.trim() || undefined,
      status: 'open',
      items: [],
      serviceFeeEnabled: false,
      splitEnabled: false,
      splitCount: MIN_SPLIT_COUNT,
      payments: [],
      openedAt: new Date().toISOString(),
      openedByUserId: currentUser.uid,
      openedByUserName: currentUser.displayName,
    };

    setTable(orgId, newTable).catch(warnAndAlert('abrir mesa', 'Não foi possível abrir a mesa'));
    logAuditEvent({
      orgId,
      userId: currentUser.uid,
      userName: currentUser.displayName,
      type: 'table_opened',
      tableId: id,
      tableLabel: trimmedLabel,
    });
    notifyAdmins(orgId, 'Mesa aberta', `${currentUser.displayName} abriu a mesa ${trimmedLabel}.`);

    return id;
  },

  renameTable: (tableId, label) => {
    const { orgId, currentUser, tables } = get();
    if (!orgId || !currentUser) return;
    const table = tables.find((t) => t.id === tableId);
    if (!table || table.status !== 'open') return;
    const trimmed = label.trim();
    if (!trimmed || trimmed === table.label) return;

    updateTable(orgId, tableId, { label: trimmed }).catch(
      warnAndAlert('renomear mesa', 'Não foi possível renomear a mesa')
    );
    logAuditEvent({
      orgId,
      userId: currentUser.uid,
      userName: currentUser.displayName,
      type: 'table_renamed',
      tableId,
      tableLabel: trimmed,
      detail: `De "${table.label}" para "${trimmed}"`,
    });
  },

  addItem: (tableId, menuItem, quantity = 1) => {
    const { orgId, currentUser, tables } = get();
    if (!orgId || !currentUser) return;
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;

    // Id da linha gerado uma vez, fora da transação (que pode rodar de novo):
    // assim a mesma linha não é criada duas vezes numa nova tentativa.
    const newLine: OrderItem = {
      id: generateId('item'),
      menuItemId: menuItem.id,
      name: menuItem.name,
      category: menuItem.category,
      unitPrice: menuItem.price,
      quantity,
    };
    const existing = table.items.find((i) => i.menuItemId === menuItem.id);
    const items: OrderItem[] = existing
      ? table.items.map((i) => (i.id === existing.id ? { ...i, quantity: i.quantity + quantity } : i))
      : [...table.items, newLine];

    set({ tables: withItems(tables, tableId, items) });
    commitItems(
      orgId,
      tableId,
      (current) => {
        const found = current.find((i) => i.menuItemId === menuItem.id);
        if (found) {
          return current.map((i) => (i.id === found.id ? { ...i, quantity: i.quantity + quantity } : i));
        }
        return [...current, newLine];
      },
      items,
      'Não foi possível adicionar o item'
    );
    logAuditEvent({
      orgId,
      userId: currentUser.uid,
      userName: currentUser.displayName,
      type: 'items_added',
      tableId,
      tableLabel: table.label,
      detail: `${quantity}x ${menuItem.name}`,
    });
    notifyAdmins(
      orgId,
      'Itens adicionados',
      `${currentUser.displayName} adicionou ${quantity}x ${menuItem.name} na mesa ${table.label}.`
    );
  },

  incrementItem: (tableId, orderItemId) => {
    const { orgId, tables } = get();
    if (!orgId) return;
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;
    const items = table.items.map((i) =>
      i.id === orderItemId ? { ...i, quantity: i.quantity + 1 } : i
    );
    set({ tables: withItems(tables, tableId, items) });
    commitItems(
      orgId,
      tableId,
      (current) => current.map((i) => (i.id === orderItemId ? { ...i, quantity: i.quantity + 1 } : i)),
      items,
      'Não foi possível atualizar o item'
    );
  },

  decrementItem: (tableId, orderItemId) => {
    const { orgId, tables } = get();
    if (!orgId) return;
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;
    const items = table.items
      .map((i) => (i.id === orderItemId ? { ...i, quantity: i.quantity - 1 } : i))
      .filter((i) => i.quantity > 0);
    set({ tables: withItems(tables, tableId, items) });
    commitItems(
      orgId,
      tableId,
      (current) =>
        current
          .map((i) => (i.id === orderItemId ? { ...i, quantity: i.quantity - 1 } : i))
          .filter((i) => i.quantity > 0),
      items,
      'Não foi possível atualizar o item'
    );
  },

  removeItem: (tableId, orderItemId) => {
    const { orgId, tables } = get();
    if (!orgId) return;
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;
    const items = table.items.filter((i) => i.id !== orderItemId);
    set({ tables: withItems(tables, tableId, items) });
    commitItems(
      orgId,
      tableId,
      (current) => current.filter((i) => i.id !== orderItemId),
      items,
      'Não foi possível remover o item'
    );
  },

  toggleServiceFee: (tableId) => {
    const { orgId, tables } = get();
    if (!orgId) return;
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;
    updateTable(orgId, tableId, { serviceFeeEnabled: !table.serviceFeeEnabled }).catch(
      warnAndAlert('atualizar taxa de serviço', 'Não foi possível atualizar a taxa de serviço')
    );
  },

  toggleSplit: (tableId) => {
    const { orgId, tables } = get();
    if (!orgId) return;
    const table = tables.find((t) => t.id === tableId);
    if (!table || table.payments.length > 0) return;
    updateTable(orgId, tableId, { splitEnabled: !table.splitEnabled }).catch(
      warnAndAlert('atualizar divisão de conta', 'Não foi possível atualizar a divisão da conta')
    );
  },

  setSplitCount: (tableId, count) => {
    const { orgId, tables } = get();
    if (!orgId) return;
    const table = tables.find((t) => t.id === tableId);
    if (!table || table.payments.length > 0) return;
    const clamped = Math.min(MAX_SPLIT_COUNT, Math.max(MIN_SPLIT_COUNT, Math.round(count)));
    updateTable(orgId, tableId, { splitCount: clamped }).catch(
      warnAndAlert('atualizar divisão de conta', 'Não foi possível atualizar a divisão da conta')
    );
  },

  recordPayment: async (tableId, method) => {
    const { orgId, currentUser, tables } = get();
    if (!orgId || !currentUser) return { ok: false, fullyPaid: false };
    const table = tables.find((t) => t.id === tableId);
    if (!table) return { ok: false, fullyPaid: false };

    // Transação (não o `amount`/`payments` calculados a partir do estado
    // local): o valor da parcela e a checagem de "já está tudo pago" são
    // recalculados no servidor a partir do documento fresco, pra dois
    // pagamentos simultâneos na mesma mesa dividida (dois garçons cobrando
    // ao mesmo tempo) não se sobrescreverem.
    const result = await recordPaymentTransaction(orgId, tableId, {
      id: generateId('pay'),
      method,
      paidAt: new Date().toISOString(),
    });
    if (result.status !== 'ok') return { ok: result.status === 'already-paid', fullyPaid: result.fullyPaid };

    logAuditEvent({
      orgId,
      userId: currentUser.uid,
      userName: currentUser.displayName,
      type: 'payment_recorded',
      tableId,
      tableLabel: table.label,
      detail: `${PAYMENT_METHOD_LABEL[method]} · ${result.amount.toFixed(2)}`,
    });
    notifyAdmins(
      orgId,
      'Pagamento registrado',
      `${currentUser.displayName} registrou ${PAYMENT_METHOD_LABEL[method]} (R$ ${result.amount.toFixed(2)}) na mesa ${table.label}.`
    );
    return { ok: true, fullyPaid: result.fullyPaid };
  },

  closeTable: async (tableId) => {
    const { orgId, currentUser, tables } = get();
    if (!orgId || !currentUser) return 'not-found';
    const table = tables.find((t) => t.id === tableId);
    if (!table) return 'not-found';

    const saleId = generateId('sale');
    const result = await closeTableTransaction(orgId, tableId, saleId, {
      userId: currentUser.uid,
      userName: currentUser.displayName,
    });

    if (result === 'ok') {
      logAuditEvent({
        orgId,
        userId: currentUser.uid,
        userName: currentUser.displayName,
        type: 'table_closed',
        tableId,
        tableLabel: table.label,
      });
      notifyAdmins(orgId, 'Mesa fechada', `${currentUser.displayName} fechou a mesa ${table.label}.`);
    }

    return result;
  },

  endDay: async () => {
    const { orgId, currentUser, salesWindowStart, currentDay } = get();
    if (!orgId || !currentUser) return null;

    // Lido direto do servidor (não da foto local de `closedSalesToday`): o
    // listener local pode estar alguns instantes atrasado, especialmente
    // quando o fechamento de uma mesa e o encerramento do dia acontecem em
    // dispositivos diferentes — nesse caso, encerrar com base no listener
    // deixaria essa venda de fora do rollup do dia para sempre (a próxima
    // janela começa depois deste corte).
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const since = salesWindowStart ?? startOfToday.toISOString();
    const sales = await getClosedSalesSince(orgId, since);

    if (sales.length === 0) {
      set({ currentDay: formatDateKey() });
      return null;
    }

    const paymentBreakdown: Record<PaymentMethod, number> = {
      pix: 0,
      dinheiro: 0,
      debito: 0,
      credito: 0,
    };
    let totalRevenue = 0;
    sales.forEach((sale) => {
      sale.payments.forEach((payment) => {
        paymentBreakdown[payment.method] = round2(
          paymentBreakdown[payment.method] + payment.amount
        );
      });
      totalRevenue += sale.total;
    });

    const closedAt = new Date().toISOString();
    const summary: DaySummary = {
      date: currentDay,
      totalRevenue: round2(totalRevenue),
      sales,
      closedAt,
      paymentBreakdown,
    };

    await clearClosedTablesAndSummarize(orgId, {
      date: currentDay,
      totalRevenue: summary.totalRevenue,
      paymentBreakdown,
      closedAt,
    });

    // Reinicia a janela de "vendas de hoje" a partir de agora — sem isso, o
    // Dashboard (faturamento, ticket médio, mais vendidos) continuaria
    // somando as vendas do turno recém-encerrado com as do próximo turno
    // sempre que ambos caírem no mesmo dia civil.
    closedSalesUnsubscribe?.();
    closedSalesUnsubscribe = subscribeClosedSalesSince(orgId, closedAt, (closedSalesToday) =>
      set({ closedSalesToday })
    );

    set({ currentDay: formatDateKey(), closedSalesToday: [], salesWindowStart: closedAt });

    return summary;
  },
}));

const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  debito: 'Débito',
  credito: 'Crédito',
};

// --- Selectors / helpers ---

export function getOpenTables(tables: Table[]): Table[] {
  return tables.filter((t) => t.status === 'open');
}

export function getClosedTablesToday(tables: Table[]): Table[] {
  return tables.filter((t) => t.status === 'closed');
}

export function getTableCurrentTotal(table: Table): number {
  return computeTotals(table.items, table.serviceFeeEnabled).total;
}

export function getTodayRevenue(closedSalesToday: ClosedSale[]): number {
  return closedSalesToday.reduce((sum, sale) => sum + sale.total, 0);
}

export function getPaidTotal(table: Table): number {
  return round2(table.payments.reduce((sum, p) => sum + p.amount, 0));
}

export function getRemainingAmount(table: Table): number {
  const { total } = computeTotals(table.items, table.serviceFeeEnabled);
  return Math.max(0, round2(total - getPaidTotal(table)));
}

// Valor por pessoa "teórico" (total / splitCount), usado para exibição no
// card de resumo. Arredondado para 2 casas decimais.
export function getSplitUnitAmount(table: Table): number {
  const { total } = computeTotals(table.items, table.serviceFeeEnabled);
  return round2(total / table.splitCount);
}

export function getPaidPeopleCount(table: Table): number {
  return table.payments.length;
}

export function isTableFullyPaid(table: Table): boolean {
  return getRemainingAmount(table) <= PAID_EPSILON;
}

export function getNextPaymentAmount(table: Table): number {
  return computeNextPaymentAmount(table);
}

export interface TopSellingItem {
  menuItemId: string;
  name: string;
  quantity: number;
}

export function getTopSellingItems(
  tables: Table[],
  closedSalesToday: ClosedSale[],
  limit = 5
): TopSellingItem[] {
  const counts = new Map<string, TopSellingItem>();

  // Closed tables' items are already represented in closedSalesToday, so
  // only open tables are included here to avoid double-counting.
  const allItems: OrderItem[] = [
    ...getOpenTables(tables).flatMap((t) => t.items),
    ...closedSalesToday.flatMap((s) => s.items),
  ];

  allItems.forEach((item) => {
    const existing = counts.get(item.menuItemId);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      counts.set(item.menuItemId, {
        menuItemId: item.menuItemId,
        name: item.name,
        quantity: item.quantity,
      });
    }
  });

  return Array.from(counts.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit);
}

export { MAX_SPLIT_COUNT, MIN_SPLIT_COUNT, PAID_EPSILON, SERVICE_FEE_RATE } from '../utils/billing';
