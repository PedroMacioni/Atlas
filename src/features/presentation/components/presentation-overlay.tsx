import { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { CaptionBar } from './caption-bar';
import { IntroScreen } from './intro-screen';
import { SpotlightOverlay } from './spotlight-overlay';
import { usePresentation } from '../hooks/use-presentation';
import { useActRunner, type ActCallbacks } from '../hooks/use-act-runner';
import { resetPresentation } from '../state/presentation-state';
import type { DemoDrive } from '@/features/demo/hooks/use-demo-drive';
import { setDemoScenario } from '@/features/demo/state/demo-scenario';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@/theme/spacing';

export type PresentationOverlayProps = {
  demoDrive: DemoDrive;
  onTriggerRecommendation: () => void;
  onAcceptRecommendation: () => void;
  onSelectPlace: (index: number) => void;
  onCompleteTrip: () => void;
};

export function PresentationOverlay({
  demoDrive,
  onTriggerRecommendation,
  onAcceptRecommendation,
  onSelectPlace,
  onCompleteTrip,
}: PresentationOverlayProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    currentAct,
    currentActData,
    isPaused,
    caption,
    spotlightTarget,
    totalActs,
    nextAct,
    prevAct,
    togglePause,
  } = usePresentation();

  // Reset presentation state on mount
  useEffect(() => {
    resetPresentation();
    return () => {
      resetPresentation();
    };
  }, []);

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
          const index = parseInt(target.replace('place-row-', ''), 10);
          onSelectPlace(index);
        }
      },
      [onAcceptRecommendation, onSelectPlace]
    ),

    onNavigate: useCallback(
      (to: string) => {
        router.push(to as never);
      },
      [router]
    ),

    onCompleteTrip,

    onActComplete: useCallback(() => {
      // Auto-advance to next act after sequence completes
      if (currentAct < totalActs) {
        nextAct();
      }
    }, [currentAct, totalActs, nextAct]),
  };

  useActRunner(currentActData, isPaused, callbacks);

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

      {/* Caption bar centered vertically */}
      {currentAct !== 1 && (
        <View style={styles.captionContainer}>
          <CaptionBar text={caption} />
        </View>
      )}

      {/* Gesture area for tap/swipe */}
      <GestureDetector gesture={composedGesture}>
        <View style={styles.gestureArea} />
      </GestureDetector>

      {/* Control bar hidden for recording - tap to advance, swipe right to go back */}
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
