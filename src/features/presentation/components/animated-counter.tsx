import { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { TextInput, StyleSheet } from 'react-native';

import { colors } from '@/theme/colors';
import { textVariants } from '@/theme/typography';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export type AnimatedCounterProps = {
  value: number;
  format: (value: number) => string;
  duration?: number;
};

export function AnimatedCounter({ value, format, duration = 1000 }: AnimatedCounterProps) {
  const animatedValue = useSharedValue(0);

  useEffect(() => {
    animatedValue.value = withTiming(value, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [value, duration, animatedValue]);

  const animatedProps = useAnimatedProps(() => {
    const current = Math.round(animatedValue.value);
    return {
      text: format(current),
      defaultValue: format(current),
    };
  });

  return <AnimatedTextInput editable={false} style={styles.text} animatedProps={animatedProps} />;
}

const styles = StyleSheet.create({
  text: {
    ...textVariants.metric,
    color: colors.text,
    textAlign: 'center',
    padding: 0,
  },
});
