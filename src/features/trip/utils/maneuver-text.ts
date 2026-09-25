/**
 * Textos das instruções de manobra, em português.
 *
 * O serviço de rotas entrega tipo, direção e nome da rua; aqui isso vira
 * "Vire à direita na Rua Barreto Leme".
 */

import type {
  ManeuverModifier,
  ManeuverType,
  RouteStep,
} from '@/features/routing/types/route-result';

/** Ícone (MaterialCommunityIcons) de cada manobra. */
export type ManeuverIcon =
  | 'arrow-up'
  | 'arrow-top-right'
  | 'arrow-top-left'
  | 'arrow-right-top'
  | 'arrow-left-top'
  | 'arrow-u-left-top'
  | 'arrow-decision'
  | 'map-marker-check'
  | 'merge';

const DIRECTION_WORDS: Record<ManeuverModifier, string> = {
  left: 'à esquerda',
  right: 'à direita',
  'sharp-left': 'acentuadamente à esquerda',
  'sharp-right': 'acentuadamente à direita',
  'slight-left': 'levemente à esquerda',
  'slight-right': 'levemente à direita',
  straight: 'em frente',
  uturn: 'o retorno',
};

const DIRECTION_ICONS: Record<ManeuverModifier, ManeuverIcon> = {
  left: 'arrow-left-top',
  right: 'arrow-right-top',
  'sharp-left': 'arrow-left-top',
  'sharp-right': 'arrow-right-top',
  'slight-left': 'arrow-top-left',
  'slight-right': 'arrow-top-right',
  straight: 'arrow-up',
  uturn: 'arrow-u-left-top',
};

/** Verbo de cada tipo de manobra. `null` = usa o verbo da direção (caso do `turn`). */
const TYPE_VERBS: Record<ManeuverType, string | null> = {
  depart: 'Siga',
  arrive: 'Chegue ao destino',
  turn: null,
  continue: 'Continue',
  merge: 'Entre',
  'on-ramp': 'Pegue o acesso',
  'off-ramp': 'Pegue a saída',
  fork: 'Mantenha-se',
  'end-of-road': 'No fim da via, vire',
  roundabout: 'Na rotatória, siga',
  rotary: 'Na rotatória, siga',
  'new-name': 'Continue',
};

export type ManeuverPresentation = {
  /** A instrução, sem a distância: "Vire à direita na Rua Barreto Leme". */
  instruction: string;
  /** Ícone correspondente à manobra. */
  icon: ManeuverIcon;
};

/**
 * Monta a instrução de uma manobra.
 *
 * O nome da rua entra como "na <rua>" e é omitido quando não existe (alças e
 * retornos sem nome), para não sair uma frase quebrada.
 */
export function describeManeuver(step: RouteStep): ManeuverPresentation {
  const icon = maneuverIcon(step);
  const road = step.roadName.trim();

  if (step.type === 'arrive') {
    return { instruction: 'Chegue ao destino', icon: 'map-marker-check' };
  }

  const instruction = road ? `${verbPhrase(step)} na ${road}` : verbPhrase(step);

  return { instruction: capitalize(instruction), icon };
}

/**
 * A ação, sem o nome da rua.
 *
 * Dois casos especiais para o português não sair torto:
 * - `turn` + `straight` daria "Vire em frente": usamos "Siga em frente";
 * - retorno (`uturn`) tem verbo próprio: "Faça o retorno".
 */
function verbPhrase(step: RouteStep): string {
  if (step.modifier === 'uturn') {
    return 'Faça o retorno';
  }

  if (step.modifier === 'straight' && step.type === 'turn') {
    return 'Siga em frente';
  }

  const verb = TYPE_VERBS[step.type];
  const direction = step.modifier ? DIRECTION_WORDS[step.modifier] : '';

  // `turn` não tem verbo próprio: a frase começa pela direção.
  return verb ? [verb, direction].filter(Boolean).join(' ') : `Vire ${direction}`.trim();
}

function maneuverIcon(step: RouteStep): ManeuverIcon {
  if (step.type === 'arrive') {
    return 'map-marker-check';
  }

  if (step.type === 'merge' || step.type === 'on-ramp' || step.type === 'off-ramp') {
    return 'merge';
  }

  if (step.type === 'fork') {
    return 'arrow-decision';
  }

  if (step.type === 'roundabout' || step.type === 'rotary') {
    return 'arrow-decision';
  }

  return step.modifier ? DIRECTION_ICONS[step.modifier] : 'arrow-up';
}

/**
 * Distância até a manobra, arredondada para o motorista.
 *
 * Os degraus são grandes de propósito ("Em 300 m", "Em 350 m"): um número que
 * muda a cada segundo tira a atenção da rua.
 */
export function formatManeuverDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) {
    return '';
  }

  if (meters < 30) {
    return 'Agora';
  }

  if (meters < 1000) {
    // Degraus de 50 m.
    return `Em ${Math.round(meters / 50) * 50} m`;
  }

  return `Em ${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

function capitalize(text: string): string {
  return text.length > 0 ? text[0].toUpperCase() + text.slice(1) : text;
}
