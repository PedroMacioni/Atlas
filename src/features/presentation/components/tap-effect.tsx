import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

import { colors } from '@/theme/colors';

export type TapEffectProps = {
  /** Posição X do centro do efeito */
  x: number;
  /** Posição Y do centro do efeito */
  y: number;
  /** Chamado quando a animação termina */
  onComplete?: () => void;
};

/**
 * Efeito visual de toque/clique.
 *
 * Mostra um círculo que expande e desaparece, simulando um toque na tela.
 */
export function TapEffect({ x, y, onComplete }: TapEffectProps) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    // Expande o círculo
    scale.value = withSequence(
      withTiming(1, { duration: 200 }),
      withTiming(1.5, { duration: 150 })
    );

    // Desaparece
    opacity.value = withTiming(0, { duration: 350 }, (finished) => {
      if (finished && onComplete) {
        runOnJS(onComplete)();
      }
    });
  }, [scale, opacity, onComplete]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.circle,
        { left: x - 30, top: y - 30 },
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  circle: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primarySoft,
    borderWidth: 3,
    borderColor: colors.primary,
    zIndex: 1000,
  },
});
