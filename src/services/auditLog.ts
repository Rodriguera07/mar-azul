import { addDoc, collection } from 'firebase/firestore';
import { db } from '../config/firebase';
import { AuditEventType } from '../types';
import { withTimeout } from '../utils/timeout';

interface LogAuditEventInput {
  orgId: string;
  userId: string;
  userName: string;
  type: AuditEventType;
  tableId?: string;
  tableLabel?: string;
  detail?: string;
}

// Best-effort: uma falha ao registrar auditoria (ex.: sem conexão) nunca deve
// interromper a ação principal do usuário (login, abrir mesa, etc.). A
// promessa do addDoc só termina quando o servidor confirma; com a conexão
// presa (comum no iPhone ao voltar do segundo plano) ela nunca terminava e
// quem esperava por ela (sair da conta, trocar senha) ficava girando para
// sempre. Com o teto, a tela segue — a gravação continua na fila do SDK e é
// enviada assim que a conexão voltar.
export async function logAuditEvent({
  orgId,
  userId,
  userName,
  type,
  tableId,
  tableLabel,
  detail,
}: LogAuditEventInput): Promise<void> {
  try {
    await withTimeout(addDoc(collection(db, 'organizations', orgId, 'auditLog'), {
      type,
      userId,
      userName,
      tableId: tableId ?? null,
      tableLabel: tableLabel ?? null,
      detail: detail ?? null,
      timestamp: new Date().toISOString(),
    }), 6000);
  } catch (err) {
    console.warn('Falha ao registrar evento de auditoria', err);
  }
}
