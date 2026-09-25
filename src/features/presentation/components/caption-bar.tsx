import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOut } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { shadows } from '@/theme/shadows';
import { spacing } from '@/theme/spacing';

export type CaptionBarProps = {
  text: string | null;
  title: string;
  step: number;
  total: number;
};

export function CaptionBar({ text, title, step, total }: CaptionBarProps) {
  if (!text) return null;

  return (
    <Animated.View entering={FadeInUp.duration(260)} exiting={FadeOut.duration(160)} style={styles.wrap} pointerEvents="none">
      <View style={[styles.card, shadows.raised]}>
        <View style={styles.topLine}>
          <View style={styles.dot} />
          <Text variant="label" color="primary" style={styles.title} numberOfLines={1}>
            {title.toUpperCase()}
          </Text>
          <Text variant="label" color="textSecondary">
            {String(step).padStart(2, '0')}/{String(total).padStart(2, '0')}
          </Text>
        </View>
        <Text variant="body" color="text" style={styles.message}>
          {text}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  title: {
    flex: 1,
    letterSpacing: 0.8,
  },
  message: {
    lineHeight: 21,
  },
});
