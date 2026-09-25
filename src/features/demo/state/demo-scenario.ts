import { useSyncExternalStore } from 'react';

import { DEMO_SCENARIO } from '@/features/demo/constants/demo-drive';
import type { SimulationOverrides } from '@/features/recommendation/types/recommendation';

/**
 * As condições que a demonstração envia ao Random Forest.
 *
 * Fica fora do React porque duas telas usam os mesmos valores: a folha de
 * condições (que edita) e a viagem por baixo dela (que envia).
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

/** Volta ao cenário padrão (usado ao abrir uma nova demonstração). */
export function resetDemoScenario() {
  setDemoScenario(DEMO_SCENARIO);
}

/** `subscribe` é uma função fixa do módulo, para o React não refazer a inscrição a cada render. */
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useDemoScenario(): DemoScenario {
  return useSyncExternalStore(subscribe, getDemoScenario, getDemoScenario);
}
