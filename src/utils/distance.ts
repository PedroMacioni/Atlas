/**
 * Formata uma distância em metros para leitura humana em pt-BR.
 *
 * - abaixo de 1 km: arredondado para dezenas de metros ("850 m")
 * - a partir de 1 km: uma casa decimal com vírgula ("18,4 km")
 */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) {
    return '--';
  }

  if (meters < 1000) {
    const rounded = Math.round(meters / 10) * 10;
    return `${rounded} m`;
  }

  const kilometers = meters / 1000;
  return `${kilometers.toFixed(1).replace('.', ',')} km`;
}
