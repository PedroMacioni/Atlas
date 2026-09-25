/**
 * Datas e horários em português, para o histórico e o diário de bordo.
 *
 * O backend manda datas ISO 8601; aqui elas viram hora local. Data inválida
 * vira "--" em vez de "Invalid Date".
 */

function parse(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "18/09/2026, 14:32" — o cabeçalho de um card do histórico. */
export function formatDateTime(iso: string): string {
  const date = parse(iso);

  return date
    ? date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '--';
}

/** "14:32" — a hora de um evento na linha do tempo. */
export function formatClock(iso: string): string {
  const date = parse(iso);

  return date ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--';
}
