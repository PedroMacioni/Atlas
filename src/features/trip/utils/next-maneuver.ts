/**
 * Qual é a próxima manobra e a quantos metros ela está.
 *
 * Função pura: recebe as manobras e quanto já foi percorrido. Quem monta a
 * frase é `maneuver-text.ts`.
 */

import type { RouteStep } from '@/features/routing/types/route-result';

export type NextManeuver = {
  step: RouteStep;
  /** Distância que falta até a manobra, em metros. */
  distanceMeters: number;
  /** Posição na lista. */
  index: number;
};

/**
 * Tolerância para considerar uma manobra como "já passou". O GPS oscila, e
 * exigir exatamente zero faria a instrução pular para a próxima e voltar.
 */
const PASSED_TOLERANCE_METERS = 10;

/**
 * Acha a próxima manobra à frente da posição atual.
 *
 * Devolve `null` quando não há manobras ou todas já ficaram para trás.
 */
export function findNextManeuver(
  steps: RouteStep[],
  traveledMeters: number,
): NextManeuver | null {
  if (steps.length === 0) {
    return null;
  }

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    const distanceMeters = step.distanceAlongRouteMeters - traveledMeters;

    // A manobra de partida nunca é "a próxima".
    if (step.type === 'depart') {
      continue;
    }

    if (distanceMeters > -PASSED_TOLERANCE_METERS) {
      return { step, distanceMeters: Math.max(0, distanceMeters), index };
    }
  }

  return null;
}
