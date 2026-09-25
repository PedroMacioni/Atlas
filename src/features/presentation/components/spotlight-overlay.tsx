import { type PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, withTiming } from 'react-native-reanimated';

export type SpotlightOverlayProps = PropsWithChildren<{
  active: boolean;
}>;

/**
 * Camada escura sobre a tela, usada no modo apresentação.
 *
 * Com `active`, escurece a tela. O elemento em destaque fica visível porque
 * recebe um `zIndex` maior (máscaras SVG seriam lentas no React Native).
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
