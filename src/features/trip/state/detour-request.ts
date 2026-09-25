import { useSyncExternalStore } from 'react';

import type { NamedCoordinate } from '@/features/map/types/coordinate';

/**
 * Pedido de desvio vindo de fora da tela de viagem.
 *
 * A emergência abre por cima da viagem. Quando o usuário escolhe um hospital
 * ali, a viagem (que continua aberta por baixo) precisa receber esse ponto
 * como parada. Este é o "canal": a emergência publica, a viagem consome.
 */
export type DetourRequest = NamedCoordinate & { category: string; reason: string };

let pending: DetourRequest | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function requestDetour(detour: DetourRequest): void {
  pending = detour;
  emit();
}

export function consumeDetour(): void {
  pending = null;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePendingDetour(): DetourRequest | null {
  return useSyncExternalStore(subscribe, () => pending);
}

