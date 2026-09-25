import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

export type ActIndicatorProps = {
  currentAct: number;
  totalActs: number;
};

export function ActIndicator({ currentAct, totalActs }: ActIndicatorProps) {
  return (
    <View style={styles.container}>
      <View style={styles.dots}>
        {Array.from({ length: totalActs }, (_, i) => (
          <Dot key={i} filled={i < currentAct} />
        ))}
      </View>
      <Text variant="label" color="textOnPrimary">
        {currentAct}/{totalActs}
      </Text>
    </View>
  );
}

function Dot({ filled }: { filled: boolean }) {
  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: withSpring(filled ? colors.textOnPrimary : 'transparent'),
    borderColor: colors.textOnPrimary,
  }));

  return <Animated.View style={[styles.dot, animatedStyle]} />;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
});
