import { useEffect, useRef } from 'react';
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

async function executeStep(step: ActStep, callbacks: ActCallbacks): Promise<void> {
  switch (step.type) {
    case 'wait':
      return new Promise((resolve) => {
        setTimeout(resolve, step.ms);
      });

    case 'caption':
      setPresentationState({ caption: step.text });
      break;

    case 'spotlight':
      setPresentationState({ spotlightTarget: step.target });
      break;

    case 'haptic': {
      const hapticFn = HAPTIC_MAP[step.style];
      if (hapticFn) {
        try {
          await hapticFn();
        } catch {
          // Haptics may fail on simulator
        }
      }
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
}

export function useActRunner(act: Act | undefined, isPaused: boolean, callbacks: ActCallbacks) {
  const lastActIdRef = useRef<number | undefined>(undefined);
  const callbacksRef = useRef(callbacks);
  const isPausedRef = useRef(isPaused);
  const abortRef = useRef(false);

  // Keep refs in sync
  callbacksRef.current = callbacks;
  isPausedRef.current = isPaused;

  useEffect(() => {
    if (!act) return;

    // Only run when act changes
    if (lastActIdRef.current === act.id) return;
    lastActIdRef.current = act.id;

    // Abort previous sequence
    abortRef.current = true;

    const runSequence = async () => {
      // Small delay to let abort propagate
      await new Promise((r) => setTimeout(r, 10));
      abortRef.current = false;

      for (const step of act.sequence) {
        // Check abort before each step
        if (abortRef.current) return;

        // Wait while paused
        while (isPausedRef.current) {
          await new Promise((r) => setTimeout(r, 100));
          if (abortRef.current) return;
        }

        try {
          await executeStep(step, callbacksRef.current);
        } catch {
          // Step failed, continue
        }
      }

      // Sequence complete - auto advance
      if (!abortRef.current) {
        callbacksRef.current.onActComplete?.();
      }
    };

    runSequence();

    return () => {
      abortRef.current = true;
    };
  }, [act]);

  return {
    isRunning: true,
  };
}
