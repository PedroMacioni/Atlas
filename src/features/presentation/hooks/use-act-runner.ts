import { useCallback, useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';

import type { Act, ActStep, HapticStyle } from '../constants/acts';
import { setPresentationState } from '../state/presentation-state';

export type ActCallbacks = {
  onDemoResume?: () => void;
  onDemoPause?: () => void;
  onTriggerRecommendation?: () => void;
  onSimulateTap?: (target: string) => void;
  onAutoType?: (text: string, field: string) => void;
  onNavigate?: (to: string) => void;
  onCompleteTrip?: () => void;
  onActComplete?: () => void;
};

const HAPTIC_MAP: Record<HapticStyle, (() => Promise<void>) | null> = {
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  none: null,
};

export function useActRunner(act: Act | undefined, isPaused: boolean, callbacks: ActCallbacks) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepIndexRef = useRef(0);
  const isRunningRef = useRef(false);
  const actIdRef = useRef<number | undefined>(undefined);

  const clearCurrentTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const executeStep = useCallback(
    async (step: ActStep): Promise<void> => {
      switch (step.type) {
        case 'wait':
          return new Promise((resolve) => {
            timeoutRef.current = setTimeout(resolve, step.ms);
          });

        case 'caption':
          setPresentationState({ caption: step.text });
          break;

        case 'spotlight':
          setPresentationState({ spotlightTarget: step.target });
          break;

        case 'haptic': {
          const hapticFn = HAPTIC_MAP[step.style];
          if (hapticFn) await hapticFn();
          break;
        }

        case 'demo-resume':
          callbacks.onDemoResume?.();
          break;

        case 'demo-pause':
          callbacks.onDemoPause?.();
          break;

        case 'trigger-recommendation':
          callbacks.onTriggerRecommendation?.();
          break;

        case 'simulate-tap':
          callbacks.onSimulateTap?.(step.target);
          break;

        case 'auto-type':
          callbacks.onAutoType?.(step.text, step.field);
          break;

        case 'navigate':
          callbacks.onNavigate?.(step.to);
          break;

        case 'complete-trip':
          callbacks.onCompleteTrip?.();
          break;
      }
    },
    [callbacks]
  );

  const runSequence = useCallback(async () => {
    if (!act || isPaused || isRunningRef.current) return;

    isRunningRef.current = true;

    for (let i = stepIndexRef.current; i < act.sequence.length; i++) {
      if (isPaused || actIdRef.current !== act.id) {
        stepIndexRef.current = i;
        isRunningRef.current = false;
        return;
      }

      try {
        await executeStep(act.sequence[i]);
      } catch {
        // Step failed, continue to next
      }
      stepIndexRef.current = i + 1;
    }

    isRunningRef.current = false;
    callbacks.onActComplete?.();
  }, [act, isPaused, executeStep, callbacks]);

  // Reset and start when act changes
  useEffect(() => {
    if (!act) return;

    // Act changed
    if (actIdRef.current !== act.id) {
      clearCurrentTimeout();
      stepIndexRef.current = 0;
      isRunningRef.current = false;
      actIdRef.current = act.id;
      runSequence();
    }

    return clearCurrentTimeout;
  }, [act, clearCurrentTimeout, runSequence]);

  // Resume when unpaused
  useEffect(() => {
    if (!isPaused && act && stepIndexRef.current > 0 && !isRunningRef.current) {
      runSequence();
    }
  }, [isPaused, act, runSequence]);

  return {
    isRunning: isRunningRef.current,
    currentStep: stepIndexRef.current,
  };
}
