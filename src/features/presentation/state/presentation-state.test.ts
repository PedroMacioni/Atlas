import { describe, it, expect, beforeEach } from 'vitest';
import {
  getPresentationState,
  setPresentationState,
  resetPresentation,
} from './presentation-state';

describe('presentation-state', () => {
  beforeEach(() => {
    resetPresentation();
  });

  it('starts at act 1 and not paused', () => {
    const state = getPresentationState();
    expect(state.currentAct).toBe(1);
    expect(state.isPaused).toBe(false);
  });

  it('updates currentAct', () => {
    setPresentationState({ currentAct: 3 });
    expect(getPresentationState().currentAct).toBe(3);
  });

  it('updates isPaused', () => {
    setPresentationState({ isPaused: true });
    expect(getPresentationState().isPaused).toBe(true);
  });

  it('resets to initial state', () => {
    setPresentationState({ currentAct: 5, isPaused: true });
    resetPresentation();
    const state = getPresentationState();
    expect(state.currentAct).toBe(1);
    expect(state.isPaused).toBe(false);
  });
});
