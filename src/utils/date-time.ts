/**
 * Datas e horários em pt-BR, para o histórico e o diário de bordo.
 *
 * O backend manda ISO 8601 com fuso; `Intl` converte para a hora local do
 * aparelho. Uma data inválida vira traço em vez de "Invalid Date" na tela.
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
