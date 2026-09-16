import { StyleSheet, View } from 'react-native';

import { IconBadge, type IconName } from '@/components/ui/icon-badge';
import { Text } from '@/components/ui/text';
import { colors, type ColorToken } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';

export type MetricTileProps = {
  icon: IconName;
  label: string;
  value: string;
  iconColor?: ColorToken;
  /** `full` ocupa a linha inteira em vez de metade. */
  span?: 'half' | 'full';
};

/** Bloco de métrica: ícone circular, rótulo pequeno e valor destacado. */
export function MetricTile({
  icon,
  label,
  value,
  iconColor = 'primary',
  span = 'half',
}: MetricTileProps) {
  return (
    <View style={[styles.container, span === 'half' ? styles.half : styles.full]}>
      <IconBadge name={icon} size="sm" color={iconColor} />

      <View style={styles.texts}>
        <Text variant="label" color="textSecondary" numberOfLines={1}>
          {label}
        </Text>
        <Text variant="metric" numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  half: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '46%',
  },
  full: {
    alignSelf: 'stretch',
  },
  texts: {
    flex: 1,
    gap: 1,
  },
});
