import { Pressable, StyleSheet } from 'react-native';

import { IconBadge, type IconName } from '@/components/ui/icon-badge';
import { Text } from '@/components/ui/text';
import { colors, type ColorToken } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { shadows } from '@/theme/shadows';
import { spacing } from '@/theme/spacing';

export type CategoryChipProps = {
  icon: IconName;
  label: string;
  color: ColorToken;
  /** Ação do toque. Omitir deixa o bloco inerte. */
  onPress?: () => void;
  /** Destaca o bloco como filtro ativo. */
  selected?: boolean;
  /** Atenua o bloco quando a categoria ainda não é acionável. */
  inactive?: boolean;
};

/**
 * Bloco quadrado de categoria — posto, comida, estacionamento, salvos.
 *
 * Serve tanto como filtro acionável (busca de destino) quanto como vitrine
 * inerte, quando a capacidade por trás dele ainda não existe.
 */
export function CategoryChip({
  icon,
  label,
  color,
  onPress,
  selected = false,
  inactive = false,
}: CategoryChipProps) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? label : undefined}
      accessibilityState={{ selected, disabled: inactive }}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        selected && styles.selected,
        inactive && styles.inactive,
        pressed && styles.pressed,
      ]}>
      <IconBadge name={icon} size="sm" color={color} bare />
      <Text
        variant="label"
        color={selected ? 'primary' : 'text'}
        align="center"
        numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '21%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.card,
  },
  selected: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  inactive: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.65,
  },
});
