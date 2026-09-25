import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';

export type CaptionBarProps = {
  text: string | null;
};

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

export function CaptionBar({ text }: CaptionBarProps) {
  if (!text) {
    return null;
  }

  return (
    <AnimatedBlurView
      intensity={80}
      tint="dark"
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      style={styles.container}
    >
      <Text variant="body" color="textOnPrimary" align="center">
        {text}
      </Text>
    </AnimatedBlurView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
});
