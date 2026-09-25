/** Velocidade: o GPS informa em metros por segundo; o motorista lê em km/h. */

const METERS_PER_SECOND_TO_KM_PER_HOUR = 3.6;

/**
 * Converte a velocidade do GPS para km/h, ou devolve `null` quando não há
 * leitura confiável.
 *
 * O iOS devolve `-1` quando não sabe a velocidade (parado, sem sinal). Por
 * isso valores negativos viram `null`, e não uma velocidade negativa.
 */
export function toKilometersPerHour(metersPerSecond: number | null): number | null {
  if (metersPerSecond === null || !Number.isFinite(metersPerSecond) || metersPerSecond < 0) {
    return null;
  }

  return metersPerSecond * METERS_PER_SECOND_TO_KM_PER_HOUR;
}

/**
 * Formata a velocidade para o mostrador: número inteiro, sem casas decimais
 * (47 e 47,3 km/h dão no mesmo para quem dirige).
 */
export function formatSpeed(kilometersPerHour: number): string {
  if (!Number.isFinite(kilometersPerHour)) {
    return '0';
  }

  return String(Math.round(kilometersPerHour));
}
