import { useCallback, useEffect, useRef } from 'react';
import {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/theme/colors';

const PULSE_DURATION = 750;

export function useGlowPulse() {
  const glowOpacity = useSharedValue(0);
  const isActive = useRef(false);

  const glowStyle = useAnimatedStyle(() => ({
    shadowColor: colors.primary,
    shadowOpacity: glowOpacity.value,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  }));

  const startPulse = useCallback(() => {
    if (isActive.current) return;
    isActive.current = true;

    // Reanimated shared values are intentionally mutable outside render.
    // eslint-disable-next-line react-hooks/immutability
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: PULSE_DURATION }),
        withTiming(0.3, { duration: PULSE_DURATION })
      ),
      -1, // infinite
      false
    );
  }, [glowOpacity]);

  const stopPulse = useCallback(() => {
    isActive.current = false;
    cancelAnimation(glowOpacity);
    // eslint-disable-next-line react-hooks/immutability
    glowOpacity.value = withTiming(0, { duration: 200 });
  }, [glowOpacity]);

  useEffect(() => {
    return () => {
      cancelAnimation(glowOpacity);
    };
  }, [glowOpacity]);

  return { glowStyle, startPulse, stopPulse };
}
