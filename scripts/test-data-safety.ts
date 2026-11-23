// Teste de robustez dos dados: joga milhares de combinações aleatórias de dados
// corrompidos (campos nulos, tipos trocados, datas inválidas, NaN, textos
// enormes…) nos validadores (src/utils/sanitize) e nas contas que as telas usam
// (totais, relatórios, formatadores) e confere que NADA lança erro — um erro
// aqui vira tela branca no app. Rode com:  npm run test:data
import { sanitizeTable, sanitizeClosedSale, sanitizeMenuItems, sanitizeUserProfile, sanitizeAuditEntry, sanitizeOrderItem } from '../src/utils/sanitize';
import { computeTotals, computeNextPaymentAmount, isPaidInFull } from '../src/utils/billing';
import { getPeriodReport } from '../src/utils/reports';
import { formatCurrency, formatTime, formatDateLabel, formatElapsed, formatDateKey, toIsoSafe } from '../src/utils/format';

let seed = 1234567;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const junk = (depth = 0): any => {
  const leaf = [null, undefined, '', ' ', 'abc', '2026-13-45', 'invalido', '9'.repeat(40), '😀🍺', '<script>', NaN, Infinity, -Infinity, -1, 0, 1, 1e21, 0.1 + 0.2, true, false, {}, [], () => 1, Symbol.iterator.toString(), new Date('x'), 'x'.repeat(500)];
  const r = rnd();
  if (depth > 2 || r < 0.55) return pick(leaf);
  if (r < 0.8) return Array.from({ length: Math.floor(rnd() * 4) }, () => junk(depth + 1));
  const o: any = {};
  for (const k of ['id', 'label', 'status', 'items', 'payments', 'price', 'name', 'category', 'quantity', 'unitPrice', 'total', 'subtotal', 'openedAt', 'closedAt', 'role', 'active', 'type', 'timestamp', 'splitCount', 'method', 'amount', 'menuItemId', 'email', 'displayName'])
    if (rnd() < 0.4) o[k] = junk(depth + 1);
  return o;
};
const goodish = () => ({
  id: 't', label: '2', status: pick(['open', 'closed', 'x']), items: [junk(), { id: 'i', menuItemId: 'm', name: 'N', category: 'drinks', unitPrice: junk(), quantity: junk() }],
  serviceFeeEnabled: junk(), splitEnabled: junk(), splitCount: junk(), payments: [junk(), { id: 'p', method: junk(), amount: junk(), paidAt: junk() }], openedAt: junk(), closedAt: junk(), total: junk(), subtotal: junk(),
});

let failures = 0, runs = 0;
const guard = (name: string, fn: () => void, input: unknown) => {
  runs++;
  try { fn(); } catch (e: any) {
    failures++;
    if (failures <= 8) console.log(`FALHA em ${name}: ${e?.message}\n   entrada: ${JSON.stringify(input, (_k, v) => (typeof v === 'number' && !Number.isFinite(v) ? String(v) : typeof v === 'function' ? 'fn' : v))?.slice(0, 200)}`);
  }
};
const isNum = (n: unknown) => typeof n === 'number' && Number.isFinite(n);

for (let i = 0; i < 6000; i++) {
  const raw = rnd() < 0.5 ? junk() : goodish();
  guard('sanitizeTable + billing + formatadores', () => {
    const t = sanitizeTable('t1', raw);
    if (!Array.isArray(t.items) || !Array.isArray(t.payments)) throw new Error('items/payments não são listas');
    t.items.forEach((it) => { if (!isNum(it.unitPrice) || !isNum(it.quantity) || typeof it.name !== 'string') throw new Error('item com campo inválido'); });
    const tot = computeTotals(t.items, t.serviceFeeEnabled);
    if (![tot.subtotal, tot.serviceFeeAmount, tot.total].every(isNum)) throw new Error('total não numérico');
    if (!isNum(computeNextPaymentAmount(t))) throw new Error('próximo pagamento inválido');
    isPaidInFull(t);
    formatCurrency(tot.total); formatTime(t.openedAt); formatDateLabel(t.openedAt); formatElapsed(t.openedAt);
    if (t.status !== 'open' && t.status !== 'closed') throw new Error('status inválido');
  }, raw);
  guard('sanitizeClosedSale + relatório', () => {
    const s = sanitizeClosedSale('s1', raw);
    if (!Array.isArray(s.items) || !Array.isArray(s.payments)) throw new Error('listas inválidas');
    const rep = getPeriodReport([s, sanitizeClosedSale('s2', goodish())], new Date(), new Date());
    if (!isNum(rep.totalRevenue)) throw new Error('faturamento inválido');
    formatDateLabel(s.closedAt); formatTime(s.openedAt);
  }, raw);
  guard('sanitizeMenuItems', () => {
    const m = sanitizeMenuItems([raw, junk(), { id: 'a', name: 'b', category: junk(), price: junk() }]);
    m.forEach((i) => { if (!isNum(i.price) || typeof i.name !== 'string' || !i.name) throw new Error('item de cardápio inválido'); });
  }, raw);
  guard('sanitizeMenuItems (lista inteira lixo)', () => { sanitizeMenuItems(raw); }, raw);
  guard('sanitizeUserProfile', () => {
    const u = sanitizeUserProfile('u1', raw);
    if (u.role !== 'admin' && u.role !== 'staff') throw new Error('papel inválido');
    if (typeof u.active !== 'boolean') throw new Error('active não booleano');
    if (!u.displayName) throw new Error('sem nome');
    if (u.role === 'admin' && (raw as any)?.role !== 'admin') throw new Error('PROMOVEU a admin sem ser admin');
  }, raw);
  guard('sanitizeAuditEntry', () => {
    const a = sanitizeAuditEntry('a1', raw);
    formatTime(a.timestamp); formatDateLabel(a.timestamp);
    if (typeof a.userName !== 'string') throw new Error('userName inválido');
  }, raw);
  guard('sanitizeOrderItem', () => { sanitizeOrderItem(raw, 0); }, raw);
}
guard('formatadores com entrada ruim', () => {
  for (const v of [undefined, null, '', 'x', NaN, 123, {}, [], new Date('x')] as any[]) { formatTime(v); formatDateLabel(v); formatElapsed(v); formatCurrency(v); toIsoSafe(new Date('x')); formatDateKey(new Date('x')); }
}, 'formatadores');
console.log(`${runs} execuções, ${failures} falha(s)`);
console.log(failures === 0 ? '\nTODOS OS TESTES PASSARAM' : '\nHÁ FALHAS');
process.exit(failures ? 1 : 0);
