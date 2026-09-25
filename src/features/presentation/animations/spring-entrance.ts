import type { SharedValue } from 'react-native-reanimated';
import {
  interpolate,
  useAnimatedStyle,
  withSpring,
  type WithSpringConfig,
} from 'react-native-reanimated';

export const SPRING_CONFIG: WithSpringConfig = {
  damping: 15,
  stiffness: 150,
  mass: 1,
};

export const SPRING_FAST: WithSpringConfig = {
  damping: 20,
  stiffness: 200,
  mass: 0.8,
};

/**
 * Cria um estilo animado para entrada com spring.
 * progress: 0 = fora da tela (abaixo), 1 = posição final
 */
export function useSpringEntranceStyle(progress: SharedValue<number>) {
  return useAnimatedStyle(() => {
    const translateY = interpolate(progress.value, [0, 1], [100, 0]);
    const scale = interpolate(progress.value, [0, 1], [0.95, 1]);
    const opacity = interpolate(progress.value, [0, 0.5, 1], [0, 0.8, 1]);

    return {
      transform: [{ translateY }, { scale }],
      opacity,
    };
  });
}

/**
 * Anima um valor para 1 com spring.
 */
export function animateIn(value: SharedValue<number>): void {
  value.value = withSpring(1, SPRING_CONFIG);
}

/**
 * Anima um valor para 0 com spring rápido.
 */
export function animateOut(value: SharedValue<number>): void {
  value.value = withSpring(0, SPRING_FAST);
}
