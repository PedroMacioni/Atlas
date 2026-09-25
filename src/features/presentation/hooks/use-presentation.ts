import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';

import { ACTS, getAct } from '../constants/acts';
import { usePresentationState, setPresentationState } from '../state/presentation-state';

const TOTAL_ACTS = ACTS.length;

export function usePresentation() {
  const state = usePresentationState();

  const nextAct = useCallback(() => {
    if (state.currentAct < TOTAL_ACTS) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPresentationState({ currentAct: state.currentAct + 1 });
    }
  }, [state.currentAct]);

  const prevAct = useCallback(() => {
    if (state.currentAct > 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPresentationState({ currentAct: state.currentAct - 1 });
    }
  }, [state.currentAct]);

  const goToAct = useCallback((act: number) => {
    if (act >= 1 && act <= TOTAL_ACTS) {
      setPresentationState({ currentAct: act });
    }
  }, []);

  const togglePause = useCallback(() => {
    setPresentationState({ isPaused: !state.isPaused });
  }, [state.isPaused]);

  const setCaption = useCallback((caption: string | null) => {
    setPresentationState({ caption });
  }, []);

  const setSpotlight = useCallback((target: string | null) => {
    setPresentationState({ spotlightTarget: target });
  }, []);

  const currentActData = getAct(state.currentAct);

  return {
    currentAct: state.currentAct,
    currentActData,
    isPaused: state.isPaused,
    caption: state.caption,
    spotlightTarget: state.spotlightTarget,
    totalActs: TOTAL_ACTS,
    nextAct,
    prevAct,
    goToAct,
    togglePause,
    setCaption,
    setSpotlight,
  };
}
