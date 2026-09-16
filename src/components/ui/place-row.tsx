import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { IconBadge, type IconName } from '@/components/ui/icon-badge';
import { Text } from '@/components/ui/text';
import { colors, type ColorToken } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';

export type PlaceRowProps = {
  icon: IconName;
  iconColor?: ColorToken;
  title: string;
  subtitle: string;
  /** Coluna à direita, como "12 min" sobre "8,4 km". */
  trailingTop?: string;
  trailingBottom?: string;
  onPress?: () => void;
};

/**
 * Linha de lugar: ícone circular, nome, referência e uma coluna opcional à
 * direita. É a unidade de lista usada na busca de destino e, adiante, nas
 * opções próximas e nas sugestões de parada.
 */
export function PlaceRow({
  icon,
  iconColor = 'primary',
  title,
  subtitle,
  trailingTop,
  trailingBottom,
  onPress,
}: PlaceRowProps) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `${title}, ${subtitle}` : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}>
      <IconBadge name={icon} size="sm" color={iconColor} />

      <View style={styles.texts}>
        <Text variant="body" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="label" color="textSecondary" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      {trailingTop || trailingBottom ? (
        <View style={styles.trailing}>
          {trailingTop ? (
            <Text variant="body" align="right">
              {trailingTop}
            </Text>
          ) : null}
          {trailingBottom ? (
            <Text variant="label" color="textSecondary" align="right">
              {trailingBottom}
            </Text>
          ) : null}
        </View>
      ) : null}

      {onPress ? (
        <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textSecondary} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.6,
  },
  texts: {
    flex: 1,
    gap: 1,
  },
  trailing: {
    alignItems: 'flex-end',
    gap: 1,
  },
});
