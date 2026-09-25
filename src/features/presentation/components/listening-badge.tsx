import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { shadows } from '@/theme/shadows';
import { spacing } from '@/theme/spacing';

/**
 * Badge compacto "Atento — é só dizer Atlas".
 *
 * Aparece ao lado do velocímetro no canto superior esquerdo para indicar
 * que o modo de escuta contínua está ativo.
 */
export function ListeningBadge() {
  const insets = useSafeAreaInsets();

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      style={[
        styles.container,
        shadows.raised,
        { top: insets.top + 130 }, // Abaixo da velocidade
      ]}
    >
      <MaterialCommunityIcons name="ear-hearing" size={16} color={colors.primary} />
      <Text variant="label" color="primary">
        Atento — é só dizer Atlas
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    zIndex: 100,
  },
});
