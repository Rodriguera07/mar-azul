import { ClosedSale, MenuCategory, MenuItemInput, OrderItem, PaymentMethod, SplitPayment, Table } from '../types';

// Dados do Firestore chegam sem garantia de formato (documentos antigos,
// editados à mão, gravados por versões anteriores do app, campos faltando).
// Um único `undefined.reduce(...)` ou `price.toFixed(...)` em qualquer tela
// derruba a árvore React inteira e o usuário vê uma tela em branco. Estas
// funções normalizam o dado NA LEITURA, para o resto do app poder confiar no
// formato — em vez de espalhar checagens defensivas por todas as telas.

const CATEGORIES: MenuCategory[] = ['bebidas', 'drinks', 'doses', 'porcoes', 'pasteis'];
const PAYMENT_METHODS: PaymentMethod[] = ['pix', 'dinheiro', 'debito', 'credito'];

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : value == null ? fallback : String(value);
}

export function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

function asIso(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  return Number.isNaN(new Date(value).getTime()) ? fallback : value;
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null;
}

function asCategory(value: unknown): MenuCategory {
  return CATEGORIES.includes(value as MenuCategory) ? (value as MenuCategory) : 'bebidas';
}

export function sanitizeOrderItem(raw: unknown, index: number): OrderItem | null {
  if (!isObject(raw)) return null;
  return {
    id: asString(raw.id, `item-${index}`),
    menuItemId: asString(raw.menuItemId, asString(raw.id, `item-${index}`)),
    name: asString(raw.name, 'Item'),
    category: asCategory(raw.category),
    unitPrice: Math.max(0, asNumber(raw.unitPrice)),
    quantity: Math.max(0, asNumber(raw.quantity, 1)),
  };
}

function sanitizeOrderItems(raw: unknown): OrderItem[] {
  return asArray(raw)
    .map((item, i) => sanitizeOrderItem(item, i))
    .filter((item): item is OrderItem => item !== null);
}

function sanitizePayments(raw: unknown, fallbackIso: string): SplitPayment[] {
  return asArray(raw)
    .filter(isObject)
    .map((p, i) => ({
      id: asString(p.id, `pay-${i}`),
      method: PAYMENT_METHODS.includes(p.method) ? (p.method as PaymentMethod) : 'dinheiro',
      amount: Math.max(0, asNumber(p.amount)),
      paidAt: asIso(p.paidAt, fallbackIso),
    }));
}

export function sanitizeTable(id: string, raw: unknown): Table {
  const data: Record<string, any> = isObject(raw) ? raw : {};
  const now = new Date().toISOString();
  const openedAt = asIso(data.openedAt, now);
  return {
    ...data,
    id,
    label: asString(data.label, id),
    status: data.status === 'closed' ? 'closed' : 'open',
    items: sanitizeOrderItems(data.items),
    serviceFeeEnabled: data.serviceFeeEnabled !== false,
    splitEnabled: data.splitEnabled === true,
    splitCount: Math.max(1, Math.floor(asNumber(data.splitCount, 1))),
    payments: sanitizePayments(data.payments, openedAt),
    openedAt,
  } as Table;
}

export function sanitizeClosedSale(id: string, raw: unknown): ClosedSale {
  const data: Record<string, any> = isObject(raw) ? raw : {};
  const now = new Date().toISOString();
  const closedAt = asIso(data.closedAt, now);
  return {
    ...data,
    id: asString(data.id, id),
    tableLabel: asString(data.tableLabel, '?'),
    items: sanitizeOrderItems(data.items),
    subtotal: asNumber(data.subtotal),
    serviceFeeAmount: asNumber(data.serviceFeeAmount),
    total: asNumber(data.total),
    payments: sanitizePayments(data.payments, closedAt),
    openedAt: asIso(data.openedAt, closedAt),
    closedAt,
    closedByUserId: asString(data.closedByUserId),
    closedByUserName: asString(data.closedByUserName),
  } as ClosedSale;
}

// Itens sem id ou sem nome são descartados (não dá pra exibir nem editar);
// categoria desconhecida vira "bebidas" e preço inválido vira 0, para o item
// continuar visível e o admin poder corrigir em vez de sumir da lista.
export function sanitizeMenuItems(raw: unknown): MenuItemInput[] {
  return asArray(raw)
    .filter(isObject)
    .filter((item) => asString(item.id).trim() !== '' && asString(item.name).trim() !== '')
    .map((item) => ({
      id: asString(item.id),
      name: asString(item.name),
      category: asCategory(item.category),
      price: Math.max(0, asNumber(item.price)),
      ...(typeof item.description === 'string' && item.description ? { description: item.description } : {}),
    }));
}
