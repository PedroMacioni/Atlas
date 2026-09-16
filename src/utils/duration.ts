/**
 * Formata uma duração em segundos para leitura humana em pt-BR.
 *
 * - abaixo de 1 minuto: "menos de 1 min"
 * - abaixo de 1 hora: "27 min"
 * - a partir de 1 hora: "1 h 05 min"
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '--';
  }

  const totalMinutes = Math.round(seconds / 60);

  if (totalMinutes < 1) {
    return 'menos de 1 min';
  }

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${String(minutes).padStart(2, '0')} min`;
}
