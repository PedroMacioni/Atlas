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
      <View style={styles.texts}>
        <Text variant="label" color="textSecondary">
          {formatDateTime(trip.startedAt)}
          {inProgress ? ' · não encerrada' : ''}
        </Text>
        <Text variant="heading" numberOfLines={1}>
          {trip.destinationName}
        </Text>
        <Text variant="bodySoft" color="textSecondary" numberOfLines={1}>
          {facts.join('  ·  ')}
        </Text>
      </View>

      <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  pressed: {
    opacity: 0.8,
  },
  texts: {
    flex: 1,
    gap: 2,
  },
});
