import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import { Text } from '@/components/ui/text';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { SPRING_CONFIG } from '../animations/spring-entrance';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const appIcon = require('../../../../assets/images/icon.png');

export type IntroScreenProps = {
  visible: boolean;
};

export function IntroScreen({ visible }: IntroScreenProps) {
  const logoScale = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      // Logo aparece com bounce
      logoScale.value = withSpring(1, SPRING_CONFIG);
      // Título após 500ms
      titleOpacity.value = withDelay(500, withTiming(1, { duration: 600 }));
      // Subtítulo após 1000ms
      subtitleOpacity.value = withDelay(1000, withTiming(1, { duration: 600 }));
    } else {
      logoScale.value = 0;
      titleOpacity.value = 0;
      subtitleOpacity.value = 0;
    }
  }, [visible, logoScale, titleOpacity, subtitleOpacity]);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(300)}
      style={styles.container}
    >
      <View style={styles.content}>
        <Animated.View style={[styles.logoContainer, logoStyle]}>
          <Image source={appIcon} style={styles.logo} />
        </Animated.View>

        <Animated.View style={titleStyle}>
          <Text variant="title" align="center">
            ATLAS
          </Text>
        </Animated.View>

        <Animated.View style={subtitleStyle}>
          <Text variant="heading" color="textSecondary" align="center">
            Copiloto Inteligente de Viagem
          </Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  content: {
    alignItems: 'center',
    gap: spacing.md,
  },
  logoContainer: {
    width: 140,
    height: 140,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  logo: {
    width: 140,
    height: 140,
    borderRadius: 35,
  },
});
