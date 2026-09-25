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
  onCompleteTrip?: () => Promise<void> | void;
  onDemoVoice?: () => Promise<void>;
  onShowListening?: (visible: boolean) => void;
  hasReachedStop?: () => boolean;
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
      await callbacks.onCompleteTrip?.();
      break;

    case 'demo-voice':
      await callbacks.onDemoVoice?.();
      break;

    case 'press-element':
      setPresentationState({ pressedElement: step.target });
      break;

    case 'show-listening':
      setPresentationState({ showListening: step.visible });
      break;

    case 'demo-voice-text':
      setPresentationState({ demoVoiceText: step.text });
      break;
  }
}

export function useActRunner(act: Act | undefined, isPaused: boolean, callbacks: ActCallbacks) {
  const callbacksRef = useRef(callbacks);
  const isPausedRef = useRef(isPaused);

  useEffect(() => {
    callbacksRef.current = callbacks;
    isPausedRef.current = isPaused;
  }, [callbacks, isPaused]);

  useEffect(() => {
    if (!act) return;

    // Each act owns its cancellation flag. A later act cannot revive an old wait.
    let cancelled = false;

    const wait = async (durationMs: number) => {
      let remaining = durationMs;
      while (!cancelled && (remaining > 0 || isPausedRef.current)) {
        const startedAt = Date.now();
        await new Promise<void>((resolve) => setTimeout(resolve, Math.min(remaining || 50, 50)));
        if (!isPausedRef.current) {
          remaining -= Date.now() - startedAt;
        }
      }
    };

    const runSequence = async () => {
      for (const step of act.sequence) {
        if (cancelled) return;
        if (step.type === 'wait') {
          await wait(step.ms);
          continue;
        }
        if (step.type === 'wait-for-stop') {
          while (!cancelled && !callbacksRef.current.hasReachedStop?.()) {
            await wait(100);
          }
          continue;
        }
        await wait(0);
        if (cancelled) return;

        try {
          await executeStep(step, callbacksRef.current);
        } catch {
          // Step failed, continue
        }
      }

      // Sequence complete - auto advance
      if (!cancelled) {
        callbacksRef.current.onActComplete?.();
      }
    };

    runSequence();

    return () => {
      cancelled = true;
    };
  }, [act]);

  return {
    isRunning: true,
  };
}
