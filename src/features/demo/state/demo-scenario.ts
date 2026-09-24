import { useSyncExternalStore } from 'react';

import { DEMO_SCENARIO } from '@/features/demo/constants/demo-drive';
import type { SimulationOverrides } from '@/features/recommendation/types/recommendation';

/**
 * As condições que a demonstração apresenta ao Random Forest.
 *
 * Mora fora do React porque duas telas mexem nas mesmas variáveis: a folha de
 * condições, que as edita, e a viagem por baixo dela, que as envia ao pedir a
 * recomendação. Um estado no meio do caminho — a folha é uma tela empilhada,
 * não um filho da viagem — precisaria de contexto para atravessar a pilha.
 */

export type DemoScenario = Required<Omit<SimulationOverrides, 'emotionConfidence'>> & {
  emotionConfidence?: number;
};

let scenario: DemoScenario = DEMO_SCENARIO;

const listeners = new Set<() => void>();

export function getDemoScenario(): DemoScenario {
  return scenario;
}

export function setDemoScenario(next: DemoScenario) {
  scenario = next;
  listeners.forEach((listener) => listener());
}

/** Volta ao cenário do escopo — usado ao abrir uma nova demonstração. */
export function resetDemoScenario() {
  setDemoScenario(DEMO_SCENARIO);
}

/**
 * A inscrição é uma função de módulo, e não uma criada na renderização: um
 * `subscribe` novo a cada render faz o React refazer a inscrição toda vez.
 */
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useDemoScenario(): DemoScenario {
  return useSyncExternalStore(subscribe, getDemoScenario, getDemoScenario);
}
