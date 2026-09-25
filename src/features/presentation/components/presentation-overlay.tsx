import { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { CaptionBar } from './caption-bar';
import { IntroScreen } from './intro-screen';
import { SpotlightOverlay } from './spotlight-overlay';
import { StopArrival } from './stop-arrival';
import { usePresentation } from '../hooks/use-presentation';
import { useActRunner, type ActCallbacks } from '../hooks/use-act-runner';
import { resetPresentation, setPresentationState } from '../state/presentation-state';
import type { DemoDrive } from '@/features/demo/hooks/use-demo-drive';
import { setDemoScenario } from '@/features/demo/state/demo-scenario';
import { requestTripAction } from '@/features/trip/state/trip-action-request';

export type PresentationOverlayProps = {
  demoDrive: DemoDrive;
  stopReached: boolean;
  onTriggerRecommendation: () => void;
  onAcceptRecommendation: () => void;
  onSelectPlace: (index: number) => void;
  /** Define a parada simulada próxima para a apresentação. */
  onSetNearbyStop: () => void;
  onCompleteTrip: () => Promise<void>;
  onDemoVoice: () => Promise<void>;
  /** Ato inicial. Quando o splash já foi mostrado, começa em 2. */
  initialAct?: number;
};

export function PresentationOverlay({
  demoDrive,
  stopReached,
  onTriggerRecommendation,
  onAcceptRecommendation,
  onSetNearbyStop,
  onCompleteTrip,
  onDemoVoice,
  initialAct = 1,
}: PresentationOverlayProps) {
  const router = useRouter();
  const {
    currentAct,
    currentActData,
    isPaused,
    caption,
    spotlightTarget,
    totalActs,
    nextAct,
    prevAct,
  } = usePresentation();

  // Reset presentation state on mount. Quando initialAct > 1, o splash já foi
  // mostrado na tela anterior e começamos direto no ato indicado.
  useEffect(() => {
    resetPresentation();
    if (initialAct > 1) {
      setPresentationState({ currentAct: initialAct });
    }
    return () => {
      resetPresentation();
    };
  }, [initialAct]);

  const callbacks: ActCallbacks = {
    onDemoResume: useCallback(() => {
      if (demoDrive.isPaused) demoDrive.togglePause();
    }, [demoDrive]),

    onDemoPause: useCallback(() => {
      if (!demoDrive.isPaused) demoDrive.togglePause();
    }, [demoDrive]),

    onTriggerRecommendation: useCallback(() => {
      // Set scenario to trigger recommendation
      setDemoScenario({
        hour: 15,
        tripMinutes: 240,
        distanceKm: 190,
        minutesSinceStop: 180,
        emotion: 'cansado',
        image: 'estrada',
      });
      onTriggerRecommendation();
    }, [onTriggerRecommendation]),

    onSimulateTap: useCallback(
      (target: string) => {
        if (target === 'accept-button') {
          onAcceptRecommendation();
        } else if (target.startsWith('place-row-')) {
          // No modo apresentação, usa uma parada fixa próxima
          onSetNearbyStop();
        } else if (target === 'toggle-wake') {
          // Ativa a escuta contínua e fecha o menu
          requestTripAction('toggle-wake');
          router.back();
        }
      },
      [onAcceptRecommendation, onSetNearbyStop, router]
    ),

    onNavigate: useCallback(
      (to: string) => {
        router.push(to as never);
      },
      [router]
    ),

    onCompleteTrip,
    onDemoVoice,
    hasReachedStop: useCallback(() => stopReached, [stopReached]),

    onActComplete: useCallback(() => {
      // Auto-advance to next act after sequence completes
      if (currentAct < totalActs) {
        nextAct();
      }
    }, [currentAct, totalActs, nextAct]),
  };

  // Keep the introduction visible until the route has produced a demo position.
  useActRunner(demoDrive.position ? currentActData : undefined, isPaused, callbacks);

  // Tap anywhere to advance
  const tapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(nextAct)();
  });

  // Swipe right to go back
  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-50, 50])
    .onEnd((event) => {
      if (event.translationX > 50) {
        runOnJS(prevAct)();
      }
    });

  const composedGesture = Gesture.Race(tapGesture, swipeGesture);

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Intro screen for Act 1 */}
      <IntroScreen visible={currentAct === 1} />

      {/* Spotlight overlay - darkens everything except highlighted elements */}
      <SpotlightOverlay active={spotlightTarget !== null}>{null}</SpotlightOverlay>

      {currentAct === 7 && stopReached ? <StopArrival /> : null}

      {/* Caption bar centered vertically */}
      {currentAct !== 1 && currentAct !== 5 && currentAct !== 7 && (
        <View style={styles.captionContainer}>
          <CaptionBar key={currentAct} text={caption} title={currentActData?.name ?? ''} step={currentAct} total={totalActs} />
        </View>
      )}

      {/* Gesture area for tap/swipe */}
      <GestureDetector gesture={composedGesture}>
        <View style={styles.gestureArea} />
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    zIndex: 50,
  },
  captionContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 180,
    zIndex: 60,
  },
  gestureArea: {
    flex: 1,
  },
});
