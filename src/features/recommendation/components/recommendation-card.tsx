import { StyleSheet, View } from 'react-native';

import { IconBadge, type IconName } from '@/components/ui/icon-badge';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SecondaryButton } from '@/components/ui/secondary-button';
import { Text } from '@/components/ui/text';
import type { Recommendation } from '@/features/recommendation/types/recommendation';
import type { Decision } from '@/features/trip-session/types/trip';
import { colors, type ColorToken } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { shadows } from '@/theme/shadows';
import { spacing } from '@/theme/spacing';

export const DECISION_VISUALS: Record<Decision, { icon: IconName; color: ColorToken }> = {
  continuar: { icon: 'road-variant', color: 'primary' },
  descansar: { icon: 'bed', color: 'categoryLodging' },
  abastecer: { icon: 'gas-station', color: 'categoryFuel' },
  alimentar: { icon: 'silverware-fork-knife', color: 'categoryFood' },
  registrar_ponto_turistico: { icon: 'camera-marker', color: 'categoryNature' },
  fazer_parada: { icon: 'coffee', color: 'categoryFood' },
};

export type RecommendationCardProps = {
  recommendation: Recommendation;
  onAccept: () => void;
  onDecline: () => void;
};

/**
 * A recomendação do Atlas na tela da viagem (RF-19, §4.7).
 *
 * A decisão em letras do escopo, o motivo por extenso e a confiança. Tudo que
 * mexe na rota pede confirmação — **Aceitar** ou **Agora não** —, e o Atlas
 * nunca muda o trajeto sozinho (CA-10). CONTINUAR não pede nada: só "Ok".
 */
export function RecommendationCard({ recommendation, onAccept, onDecline }: RecommendationCardProps) {
  const visual = DECISION_VISUALS[recommendation.decision];

  return (
    <View style={[styles.card, shadows.raised]} testID="recommendation-card">
      <View style={styles.header}>
        <IconBadge name={visual.icon} color={visual.color} />
        <View style={styles.titles}>
          <Text variant="label" color="textSecondary">
            RECOMENDAÇÃO DO ATLAS · {Math.round(recommendation.confidence * 100)}%
          </Text>
          <Text variant="heading">{recommendation.label}</Text>
        </View>
      </View>

      <Text variant="bodySoft">{recommendation.justification.replace(/^Recomendação: [^.]+\. /, '')}</Text>

      {recommendation.requiresConfirmation ? (
        <View style={styles.actions}>
          <View style={styles.action}>
            <SecondaryButton label="Agora não" onPress={onDecline} />
          </View>
          <View style={styles.action}>
            <PrimaryButton label="Aceitar" showChevron={false} onPress={onAccept} testID="accept-button" />
          </View>
        </View>
      ) : (
        <SecondaryButton label="Ok" onPress={onAccept} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  titles: {
    flex: 1,
    gap: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  action: {
    flex: 1,
  },
});
