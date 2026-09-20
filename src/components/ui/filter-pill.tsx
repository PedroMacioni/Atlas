import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet } from 'react-native';

import type { IconName } from '@/components/ui/icon-badge';
import { Text } from '@/components/ui/text';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';

export type FilterPillProps = {
  icon: IconName;
  label: string;
  selected: boolean;
  onPress: () => void;
};

/**
 * Filtro que liga e desliga — pequeno, para caber ao lado de um título de
 * seção. Selecionado, fica azul; tocar de novo desliga.
 */
export function FilterPill({ icon, label, selected, onPress }: FilterPillProps) {
  const tint = selected ? colors.primary : colors.textSecondary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={spacing.sm}
      style={({ pressed }) => [
        styles.container,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}>
      <MaterialCommunityIcons name={icon} size={16} color={tint} />
      <Text variant="label" color={selected ? 'primary' : 'textSecondary'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  pressed: {
    opacity: 0.65,
  },
});
