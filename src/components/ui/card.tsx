import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { shadows } from '@/theme/shadows';
import { spacing } from '@/theme/spacing';

export type CardProps = ViewProps & {
  /** `muted` usa o azul claro; `plain` remove o preenchimento interno. */
  tone?: 'surface' | 'muted';
  padded?: boolean;
};

/** Superfície arredondada com elevação suave — a base de todo o layout. */
export function Card({ tone = 'surface', padded = true, style, ...rest }: CardProps) {
  return (
    <View
      {...rest}
      style={[
        styles.base,
        tone === 'muted' ? styles.muted : styles.surface,
        padded && styles.padded,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  surface: {
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  muted: {
    backgroundColor: colors.surfaceMuted,
  },
  padded: {
    padding: spacing.lg,
  },
});
