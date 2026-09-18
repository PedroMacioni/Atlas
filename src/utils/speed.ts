/**
 * Velocidade, do que o GPS informa para o que o velocímetro mostra.
 *
 * O aparelho reporta metros por segundo; quem dirige lê quilômetros por hora.
 */

const METERS_PER_SECOND_TO_KM_PER_HOUR = 3.6;

/**
 * Converte a leitura do GPS para km/h, ou devolve `null` quando não há leitura
 * confiável.
 *
 * `null` e valores negativos são recusados de propósito: o iOS devolve `-1`
 * quando não consegue estimar a velocidade — parado, sem sinal, ou nos
 * primeiros segundos de um trajeto — e tratar isso como número daria um
 * velocímetro marcando uma velocidade negativa.
 */
export function toKilometersPerHour(metersPerSecond: number | null): number | null {
  if (metersPerSecond === null || !Number.isFinite(metersPerSecond) || metersPerSecond < 0) {
    return null;
  }

  return metersPerSecond * METERS_PER_SECOND_TO_KM_PER_HOUR;
}

/**
 * Formata a velocidade para o mostrador.
 *
 * Inteiro, sem casa decimal: nenhuma decisão de quem dirige muda entre 47 e
 * 47,3 km/h, e um dígito que troca a cada instante só chama atenção que
 * deveria estar na via.
 *
 * Recebe número, e não `number | null`: a decisão sobre o que mostrar quando
 * não há leitura é do mostrador, não da formatação.
 */
export function formatSpeed(kilometersPerHour: number): string {
  if (!Number.isFinite(kilometersPerHour)) {
    return '0';
  }

  return String(Math.round(kilometersPerHour));
}
