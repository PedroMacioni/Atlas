/**
 * As palavras da instrução de manobra, em português.
 *
 * Esta é a camada de apresentação da navegação: o provider entrega tipo,
 * modificador e nome da via, e é aqui que isso vira "Vire à direita na Rua
 * Barreto Leme". A separação não é cerimônia — o mesmo dado precisa virar
 * frase curta na faixa, frase falada quando houver voz, e outro idioma quando
 * houver tradução.
 */

import type {
  ManeuverModifier,
  ManeuverType,
  RouteStep,
} from '@/features/routing/types/route-result';

/** Ícone do MaterialCommunityIcons que representa a manobra. */
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

/**
 * O verbo de cada tipo de manobra.
 *
 * `null` significa que o tipo não tem verbo próprio e usa o do modificador —
 * `turn` é o caso: quem manda é o lado.
 */
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
 * O nome da via entra como "na <via>" e é omitido quando o provider não o
 * informou — acontece em alças de acesso e retornos, que muitas vezes não têm
 * nome no mapa. "Pegue a saída" é uma instrução completa; "Pegue a saída na"
 * seria uma frase quebrada na cara do motorista.
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
 * A ação, sem o nome da via.
 *
 * Os dois primeiros casos existem porque a combinação crua de tipo e
 * modificador produz português torto:
 *
 * - `turn` + `straight` daria "Vire em frente", que ninguém diz. Quando o
 *   OSRM manda seguir reto, o verbo é "siga" — e isso acontece de verdade, em
 *   cruzamento onde a via muda de nome sem curva.
 * - `uturn` daria "Continue o retorno". O retorno tem verbo próprio, e ele
 *   vence o verbo do tipo.
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

  // `turn` não tem verbo próprio: a frase nasce do lado.
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
 * Distância até a manobra, na precisão que serve ao motorista.
 *
 * Diferente de `formatDistance`: aqui a leitura é feita em movimento, então os
 * degraus são grossos de propósito. "Em 320 m" e "Em 340 m" são a mesma
 * informação para quem está dirigindo, e um número que muda a cada segundo
 * pede atenção que deveria estar na rua.
 */
export function formatManeuverDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) {
    return '';
  }

  if (meters < 30) {
    return 'Agora';
  }

  if (meters < 1000) {
    // Degraus de 50 m: o suficiente para dar noção, sem piscar.
    return `Em ${Math.round(meters / 50) * 50} m`;
  }

  return `Em ${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

function capitalize(text: string): string {
  return text.length > 0 ? text[0].toUpperCase() + text.slice(1) : text;
}
