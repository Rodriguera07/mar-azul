export function formatCurrency(value: number): string {
  // Valor ausente/inválido (dado antigo ou corrompido) vira R$ 0,00 em vez de
  // lançar erro e derrubar a tela.
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function formatDateKey(date: Date = new Date()): string {
  if (Number.isNaN(date.getTime())) date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Data inválida ou ausente (documento antigo/corrompido) vira "--" em vez de
// "Invalid Date" na tela — e nunca lança erro (`toISOString()` lança RangeError
// numa data inválida, o que deixava a tela inteira em branco).
function parseDate(iso: unknown): Date | null {
  if (iso instanceof Date) return Number.isNaN(iso.getTime()) ? null : iso;
  if (typeof iso !== 'string' && typeof iso !== 'number') return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

// ISO de uma data qualquer, sem nunca lançar: data inválida cai para "agora".
export function toIsoSafe(date: Date): string {
  return (parseDate(date) ?? new Date()).toISOString();
}

export function formatTime(iso: string): string {
  const date = parseDate(iso);
  if (!date) return '--:--';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateLabel(iso: string): string {
  const date = parseDate(iso);
  if (!date) return '--/--/----';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatElapsed(iso: string): string {
  const opened = parseDate(iso);
  if (!opened) return '--';
  const openedAt = opened.getTime();
  const minutes = Math.max(0, Math.floor((Date.now() - openedAt) / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  if (days > 0) return `${days}d${String(hours).padStart(2, '0')}h`;
  if (hours > 0) return `${hours}h${String(rest).padStart(2, '0')}`;
  return `${minutes}min`;
}
