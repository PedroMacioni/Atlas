import { StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { shadows } from '@/theme/shadows';
import { spacing } from '@/theme/spacing';

/**
 * Badge compacto "Atento".
 *
 * Aparece ao lado do velocímetro (à direita) no canto superior esquerdo
 * para indicar que o modo de escuta contínua está ativo.
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
        { top: insets.top + 95 }, // Mesma altura da velocidade
      ]}
    >
      <MaterialCommunityIcons name="ear-hearing" size={14} color={colors.primary} />
      <Text variant="caption" color="primary">
        Atento
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 85, // À direita do velocímetro
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    zIndex: 100,
  },
});
