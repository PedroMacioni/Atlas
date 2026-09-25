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
 * Bloco quadrado de categoria (posto, restaurante, hotel...). Pode ser um
 * filtro clicável ou só visual.
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
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    // Todos os blocos da linha com a mesma largura, mesmo com rótulos longos.
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
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
