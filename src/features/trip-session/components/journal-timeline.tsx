import { StyleSheet, View } from 'react-native';

import { IconBadge } from '@/components/ui/icon-badge';
import { Text } from '@/components/ui/text';
import {
  DECISION_LABELS,
  EMOTION_LABELS,
  EVENT_VISUALS,
  IMAGE_CLASS_LABELS,
} from '@/features/trip-session/constants/journal-labels';
import type { TripEvent } from '@/features/trip-session/types/trip';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { formatClock } from '@/utils/date-time';

export type JournalTimelineProps = {
  events: TripEvent[];
};

/**
 * Diário de bordo em linha do tempo (§7.1).
 *
 * Cada evento mostra o que o escopo pede quando existir: horário, comando,
 * emoção com confiança, classe da imagem, decisão e o motivo dela, e as
 * coordenadas. Campo vazio não vira linha vazia — some.
 */
export function JournalTimeline({ events }: JournalTimelineProps) {
  if (events.length === 0) {
    return (
      <Text variant="bodySoft" color="textSecondary">
        Nenhum evento registrado.
      </Text>
    );
  }

  return (
    <View>
      {events.map((event, index) => (
        <JournalEntry key={event.id} event={event} isLast={index === events.length - 1} />
      ))}
    </View>
  );
}

function JournalEntry({ event, isLast }: { event: TripEvent; isLast: boolean }) {
  const visual = EVENT_VISUALS[event.kind];

  const details = [
    event.command,
    event.emotion
      ? `Emoção: ${EMOTION_LABELS[event.emotion]}${
          event.emotionConfidence !== null ? ` (${Math.round(event.emotionConfidence * 100)}%)` : ''
        }`
      : null,
    event.imageClass ? `Imagem: ${IMAGE_CLASS_LABELS[event.imageClass]}` : null,
    event.decision ? `Recomendação: ${DECISION_LABELS[event.decision]}` : null,
    event.justification ? `Motivo: ${event.justification}` : null,
    event.location
      ? `${event.location.latitude.toFixed(5)}, ${event.location.longitude.toFixed(5)}`
      : null,
  ].filter((line): line is string => Boolean(line));

  return (
    <View style={styles.entry}>
      <View style={styles.rail}>
        <IconBadge name={visual.icon} size="sm" color={visual.color} />
        {isLast ? null : <View style={styles.line} />}
      </View>

      <View style={styles.body}>
        <View style={styles.header}>
          <Text variant="body">{visual.title}</Text>
          <Text variant="label" color="textSecondary">
            {formatClock(event.occurredAt)}
          </Text>
        </View>

        {details.map((line) => (
          <Text key={line} variant="bodySoft" color="textSecondary">
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  entry: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  /** Coluna do ícone, com o traço que liga um evento ao próximo. */
  rail: {
    alignItems: 'center',
  },
  line: {
    flex: 1,
    width: 2,
    marginVertical: spacing.xs,
    backgroundColor: colors.border,
  },
  body: {
    flex: 1,
    gap: 2,
    paddingBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 34,
  },
});
