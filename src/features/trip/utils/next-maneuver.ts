/**
 * Qual é a próxima manobra, e a quantos metros ela está.
 *
 * Função pura sobre a lista de manobras e o quanto já foi percorrido. Não sabe
 * de React, de GPS nem de texto — devolve a manobra e a distância, e quem
 * monta a frase é `maneuver-text.ts`.
 */

import type { RouteStep } from '@/features/routing/types/route-result';

export type NextManeuver = {
  step: RouteStep;
  /** Distância que falta até a manobra, em metros. */
  distanceMeters: number;
  /** Índice na lista, útil para pré-visualizar a manobra seguinte. */
  index: number;
};

/**
 * A partir de quantos metros antes a manobra deixa de ser "a próxima".
 *
 * Uma manobra já passada não deve continuar na tela, mas o GPS oscila: exigir
 * que a distância chegue exatamente a zero faria a instrução pular para a
 * seguinte e voltar. Dez metros de tolerância absorvem isso.
 */
const PASSED_TOLERANCE_METERS = 10;

/**
 * Encontra a próxima manobra à frente da posição atual.
 *
 * `traveledMeters` vem do progresso da viagem, medido sobre a geometria. A
 * busca é linear sobre uma lista de poucas dezenas de itens — o custo é
 * irrelevante e o código, óbvio.
 *
 * Devolve `null` quando não há manobras, ou quando todas já ficaram atrás: no
 * fim do trajeto a instrução que importa é a de chegada, e a tela já a mostra
 * pelo próprio estado de chegada.
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

    // A manobra de partida está em zero e nunca é "a próxima": ninguém precisa
    // ser instruído a sair de onde já está.
    if (step.type === 'depart') {
      continue;
    }

    if (distanceMeters > -PASSED_TOLERANCE_METERS) {
      return { step, distanceMeters: Math.max(0, distanceMeters), index };
    }
  }

  return null;
}
