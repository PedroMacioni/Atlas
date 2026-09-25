import { type PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, withTiming } from 'react-native-reanimated';

export type SpotlightOverlayProps = PropsWithChildren<{
  active: boolean;
}>;

/**
 * Overlay escuro sobre toda a tela.
 *
 * Quando `active` é true, o overlay aparece com opacity 0.6.
 * Os filhos são renderizados normalmente sobre o overlay.
 *
 * O spotlight "buraco" para elementos específicos será implementado
 * via z-index elevado nos componentes que devem ficar destacados,
 * já que SVG masks têm performance ruim no React Native.
 */
export function SpotlightOverlay({ active, children }: SpotlightOverlayProps) {
  const opacity = useDerivedValue(() => {
    return withTiming(active ? 0.6 : 0, { duration: 300 });
  }, [active]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <>
      <Animated.View
        style={[styles.overlay, overlayStyle]}
        pointerEvents={active ? 'auto' : 'none'}
      />
      {children}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
  },
});
