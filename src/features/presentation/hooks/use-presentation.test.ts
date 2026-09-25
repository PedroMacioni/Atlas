import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  resetPresentation,
  setPresentationState,
  getPresentationState,
} from '../state/presentation-state';
import { ACTS } from '../constants/acts';

// Mock expo-haptics
vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  notificationAsync: vi.fn(),
  NotificationFeedbackType: { Success: 'success' },
}));

describe('presentation state operations', () => {
  beforeEach(() => {
    resetPresentation();
  });

  it('starts at act 1', () => {
    const state = getPresentationState();
    expect(state.currentAct).toBe(1);
  });

  it('can advance to next act', () => {
    setPresentationState({ currentAct: 2 });
    expect(getPresentationState().currentAct).toBe(2);
  });

  it('can go back to previous act', () => {
    setPresentationState({ currentAct: 3 });
    setPresentationState({ currentAct: 2 });
    expect(getPresentationState().currentAct).toBe(2);
  });

  it('ACTS has 10 entries for bounds checking', () => {
    expect(ACTS.length).toBe(10);
  });

  it('toggles isPaused', () => {
    expect(getPresentationState().isPaused).toBe(false);
    setPresentationState({ isPaused: true });
    expect(getPresentationState().isPaused).toBe(true);
  });
});
