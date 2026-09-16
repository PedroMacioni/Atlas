import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { IconName } from '@/components/ui/icon-badge';
import { colors, primaryGradient } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { shadows } from '@/theme/shadows';
import { spacing } from '@/theme/spacing';

export type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  /** Ícone à esquerda do rótulo. */
  icon?: IconName;
  /** Seta indicando avanço, à direita. */
  showChevron?: boolean;
  disabled?: boolean;
  /** Retorno tátil leve ao toque. */
  haptics?: boolean;
};

/**
 * Ação principal: pílula com gradiente azul, ícone e seta.
 *
 * É um controle desenhado, não o botão do sistema — o gradiente e a sombra do
 * design de referência não são expressáveis com `Button` nativo.
 */
export function PrimaryButton({
  label,
  onPress,
  icon,
  showChevron = true,
  disabled = false,
  haptics = true,
}: PrimaryButtonProps) {
  const handlePress = () => {
    if (haptics && Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
        // Aparelho sem motor háptico: seguir sem feedback é aceitável.
      });
    }
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.pressable,
        shadows.raised,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <LinearGradient
        colors={[...primaryGradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}>
        {icon ? (
          <MaterialCommunityIcons name={icon} size={20} color={colors.textOnPrimary} />
        ) : null}

        <Text variant="action" color="textOnPrimary" style={styles.label}>
          {label}
        </Text>

        {showChevron ? (
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color={colors.textOnPrimary}
          />
        ) : (
          <View style={styles.chevronSpacer} />
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: radius.pill,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.45,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
  },
  label: {
    flexShrink: 1,
  },
  chevronSpacer: {
    width: 22,
  },
});
