import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { Contribution } from '@/features/recommendation/types/recommendation';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';

export type ContributionBarsProps = {
  contributions: Contribution[];
};

/**
 * Por que o modelo decidiu isto — uma barra por variável (CA-16).
 *
 * Cada barra é quanto a variável empurrou a probabilidade da decisão
 * escolhida: para a direita, a favor; para a esquerda, contra. É a leitura do
 * método de Saabas que o backend calcula, sem arredondar a verdade: a soma
 * das barras mais a base dá exatamente a confiança exibida.
 */
export function ContributionBars({ contributions }: ContributionBarsProps) {
  const largest = Math.max(0.01, ...contributions.map((item) => Math.abs(item.weight)));

  return (
    <View style={styles.list}>
      {contributions.map((item) => {
        const share = Math.abs(item.weight) / largest;
        const positive = item.weight >= 0;

        return (
          <View key={item.variable} style={styles.row}>
            <View style={styles.labels}>
              <Text variant="body" numberOfLines={1} style={styles.label}>
                {item.label}
              </Text>
              <Text variant="label" color="textSecondary">
                {item.value} · {positive ? '+' : '−'}
                {Math.abs(item.weight * 100).toFixed(1)} pts
              </Text>
            </View>

            {/* Metade esquerda para "contra", metade direita para "a favor". */}
            <View style={styles.track}>
              <View style={styles.half}>
                {positive ? null : (
                  <View style={[styles.bar, styles.negative, { width: `${share * 100}%` }]} />
                )}
              </View>
              <View style={styles.axis} />
              <View style={[styles.half, styles.right]}>
                {positive ? (
                  <View style={[styles.bar, styles.positive, { width: `${share * 100}%` }]} />
                ) : null}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  row: {
    gap: spacing.xs,
  },
  labels: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  label: {
    flexShrink: 1,
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 10,
  },
  half: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  right: {
    justifyContent: 'flex-start',
  },
  axis: {
    width: 2,
    height: 16,
    backgroundColor: colors.border,
  },
  bar: {
    height: '100%',
    borderRadius: radius.pill,
  },
  positive: {
    backgroundColor: colors.primary,
  },
  negative: {
    backgroundColor: colors.danger,
  },
});
