/**
 * Horário previsto de chegada.
 *
 * "Chego às 14:32" é mais útil para o motorista do que "faltam 47 minutos".
 */

/**
 * Soma o tempo restante à hora atual e formata como "HH:MM".
 *
 * `now` pode ser passado de fora para facilitar os testes.
 */
export function formatArrivalTime(remainingSeconds: number, now: Date = new Date()): string {
  if (!Number.isFinite(remainingSeconds) || remainingSeconds < 0) {
    return '--:--';
  }

  const arrival = new Date(now.getTime() + remainingSeconds * 1000);

  // `pt-BR` usa o formato 24 h, e o `Intl` cuida do fuso horário.
  return arrival.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Tempo restante em formato curto ("1h05", "12 min"), para caber na tela. */
export function formatShortDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '--';
  }

  const totalMinutes = Math.round(seconds / 60);

  if (totalMinutes < 1) {
    return '< 1 min';
  }

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return minutes === 0 ? `${hours} h` : `${hours}h${String(minutes).padStart(2, '0')}`;
}
