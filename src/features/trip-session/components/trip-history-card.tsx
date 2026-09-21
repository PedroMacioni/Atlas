import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { EMOTION_LABELS } from '@/features/trip-session/constants/journal-labels';
import type { TripCard } from '@/features/trip-session/types/trip';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { shadows } from '@/theme/shadows';
import { spacing } from '@/theme/spacing';
import { formatShortDuration } from '@/utils/arrival';
import { formatDateTime } from '@/utils/date-time';
import { formatDistance } from '@/utils/distance';

export type TripHistoryCardProps = {
  trip: TripCard;
  onPress: () => void;
};

/**
 * Card de uma viagem no histórico (RF-28): data, destino, distância, duração,
 * paradas e emoção predominante — os seis campos que o escopo pede, nesta
 * ordem de leitura.
 */
export function TripHistoryCard({ trip, onPress }: TripHistoryCardProps) {
  const inProgress = trip.endedAt === null;

  const facts = [
    trip.distanceMeters !== null ? formatDistance(trip.distanceMeters) : null,
    trip.durationSeconds !== null ? formatShortDuration(trip.durationSeconds) : null,
    `${trip.stopCount} ${trip.stopCount === 1 ? 'parada' : 'paradas'}`,
    trip.predominantEmotion ? EMOTION_LABELS[trip.predominantEmotion] : null,
  ].filter((fact): fact is string => fact !== null);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Viagem para ${trip.destinationName}, ${formatDateTime(trip.startedAt)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, shadows.card, pressed && styles.pressed]}>
      <View style={styles.mainRow}>
        <View style={styles.routeIcon}>
          <MaterialCommunityIcons name="navigation-variant" size={22} color={colors.primary} />
        </View>

        <View style={styles.texts}>
          <Text variant="label" color="textSecondary" numberOfLines={1}>
            {formatDateTime(trip.startedAt)}
            {inProgress ? ' · não encerrada' : ''}
          </Text>
          <Text variant="heading" numberOfLines={1}>
            {trip.destinationName}
          </Text>
          <Text variant="label" color="textSecondary" numberOfLines={1}>
            De {trip.originName}
          </Text>
        </View>

        <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textSecondary} />
      </View>

      <View style={styles.facts}>
        <Text variant="bodySoft" color="textSecondary" numberOfLines={1}>
          {facts.join('  ·  ')}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.8,
  },
  texts: {
    flex: 1,
    gap: 2,
  },
  routeIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  facts: {
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
