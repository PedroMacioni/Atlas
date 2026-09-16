import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { IconBadge } from '@/components/ui/icon-badge';
import { Text } from '@/components/ui/text';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';

export type VoicePromptCardProps = {
  title: string;
  subtitle: string;
};

/**
 * Chamada para o comando de voz do Atlas.
 *
 * Inerte nesta fase. Reconhecimento de fala exige um módulo nativo de
 * terceiros que não roda no Expo Go, e a análise de voz é uma etapa futura do
 * projeto. O bloco aparece atenuado e marcado como indisponível em vez de
 * simular escuta — um microfone que não ouve é pior que um microfone ausente.
 */
export function VoicePromptCard({ title, subtitle }: VoicePromptCardProps) {
  return (
    <Card tone="muted" style={styles.card}>
      <View style={styles.badgeRow}>
        <View style={styles.halo}>
          <IconBadge name="microphone" size="md" color="primary" />
        </View>

        <View style={styles.soonTag}>
          <Text variant="label" color="textSecondary">
            Em breve
          </Text>
        </View>
      </View>

      <Text variant="body" align="center">
        {title}
      </Text>
      <Text variant="label" color="textSecondary" align="center">
        {subtitle}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.xs,
    opacity: 0.72,
  },
  badgeRow: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  /** Anel claro em volta do microfone, como no design. */
  halo: {
    padding: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  soonTag: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
});
