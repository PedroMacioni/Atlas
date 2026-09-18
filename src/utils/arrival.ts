/**
 * Horário de chegada previsto.
 *
 * É a informação que o motorista realmente usa: "14:32" responde "dá tempo?"
 * de um jeito que "faltam 47 minutos" não responde sem uma conta de cabeça.
 */

/**
 * Soma os segundos restantes ao instante atual e formata como hora local.
 *
 * `now` é injetável para que a função seja testável sem depender do relógio da
 * máquina — e porque uma tela que atualiza a cada leitura de GPS precisa de um
 * instante estável dentro do mesmo quadro.
 */
export function formatArrivalTime(remainingSeconds: number, now: Date = new Date()): string {
  if (!Number.isFinite(remainingSeconds) || remainingSeconds < 0) {
    return '--:--';
  }

  const arrival = new Date(now.getTime() + remainingSeconds * 1000);

  // `pt-BR` dá o formato de 24 h, que é o usado no Brasil — e `Intl` resolve
  // fuso e horário de verão sem conta manual.
  return arrival.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Duração restante em formato curto, para a linha de métricas.
 *
 * Diferente de `formatDuration`, que escreve "1 h 05 min" por extenso: aqui o
 * espaço é apertado e a leitura é de relance, então "1h05" serve melhor.
 */
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
