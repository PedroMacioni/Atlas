import { useSyncExternalStore } from 'react';

export type PresentationState = {
  currentAct: number;
  isPaused: boolean;
  caption: string | null;
  spotlightTarget: string | null;
};

const INITIAL_STATE: PresentationState = {
  currentAct: 1,
  isPaused: false,
  caption: null,
  spotlightTarget: null,
};

let state: PresentationState = { ...INITIAL_STATE };
const listeners = new Set<() => void>();

export function getPresentationState(): PresentationState {
  return state;
}

export function setPresentationState(next: Partial<PresentationState>): void {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

export function resetPresentation(): void {
  state = { ...INITIAL_STATE };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePresentationState(): PresentationState {
  return useSyncExternalStore(subscribe, getPresentationState, getPresentationState);
}
