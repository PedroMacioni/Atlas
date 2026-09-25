import { StyleSheet, View } from 'react-native';

import { IconBadge, type IconName } from '@/components/ui/icon-badge';
import { Text } from '@/components/ui/text';
import { colors, type ColorToken } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';

export type StatusPillProps = {
  title: string;
  subtitle?: string;
  /** Ícone à esquerda. Mutuamente exclusivo com `dotColor`. */
  icon?: IconName;
  /** Marcador circular à esquerda, para estados. */
  dotColor?: ColorToken;
  tone?: 'neutral' | 'positive';
  titleColor?: ColorToken;
};

/** Pílula de status (ex.: estado da conexão). Obs.: hoje nenhuma tela usa este componente. */
export function StatusPill({
  title,
  subtitle,
  icon,
  dotColor,
  tone = 'neutral',
  titleColor,
}: StatusPillProps) {
  return (
    <View style={[styles.container, tone === 'positive' ? styles.positive : styles.neutral]}>
      {icon ? <IconBadge name={icon} size="sm" color="primary" bare /> : null}
      {dotColor ? <View style={[styles.dot, { backgroundColor: colors[dotColor] }]} /> : null}

      <View style={styles.texts}>
        <Text
          variant="body"
          color={titleColor ?? (tone === 'positive' ? 'success' : 'text')}
          numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="label" color="textSecondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    minHeight: 58,
  },
  neutral: {
    backgroundColor: colors.surfaceMuted,
  },
  positive: {
    backgroundColor: colors.successSoft,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: radius.pill,
    marginLeft: spacing.xs,
  },
  texts: {
    flex: 1,
    gap: 1,
  },
});
