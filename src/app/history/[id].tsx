import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusMessage } from '@/components/ui/status-message';
import { Text } from '@/components/ui/text';
import { AtlasMap } from '@/features/map/components/atlas-map';
import { JournalTimeline } from '@/features/trip-session/components/journal-timeline';
import { PhotoGallery } from '@/features/trip-session/components/photo-gallery';
import { EMOTION_LABELS } from '@/features/trip-session/constants/journal-labels';
import { useTripDetail } from '@/features/trip-session/hooks/use-trip-history';
import type { TripDetail } from '@/features/trip-session/types/trip';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { formatShortDuration } from '@/utils/arrival';
import { formatDateTime } from '@/utils/date-time';
import { formatDistance } from '@/utils/distance';

/**
 * Resumo da viagem (RF-26) e detalhe do histórico (RF-29) — a mesma tela.
 *
 * Aberta ao encerrar uma viagem e ao tocar num card do histórico. Mostra os
 * indicadores de §7.2, o mapa do trajeto percorrido com as paradas, e o
 * diário de bordo em linha do tempo.
 */
export default function TripSummaryScreen() {
  const insets = useSafeAreaInsets();
  const { id, presentation } = useLocalSearchParams<{ id: string; presentation?: string }>();
  const detail = useTripDetail(id);

  return (
    <>
      <Stack.Screen options={{ title: presentation === '1' ? 'Trajeto final' : 'Resumo da viagem' }} />
      <ScrollView
        style={styles.screen}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        {detail.error ? (
          <StatusMessage tone="error" message={detail.error} onRetry={detail.reload} />
        ) : null}

        {detail.data ? (
          <Summary trip={detail.data} />
        ) : detail.isLoading ? (
          <StatusMessage tone="info" message="Carregando o resumo…" busy />
        ) : null}
      </ScrollView>
    </>
  );
}

function Summary({ trip }: { trip: TripDetail }) {
  const touristSpots = trip.events.filter((event) => event.kind === 'tourist_spot').length;
  const hasPath = trip.path.length >= 2;

  return (
    <>
      <View style={styles.titleBlock}>
        <Text variant="title">{trip.destinationName}</Text>
        <Text variant="bodySoft" color="textSecondary">
          De {trip.originName} · {formatDateTime(trip.startedAt)}
        </Text>
      </View>

      <View style={styles.map}>
        <AtlasMap
          currentLocation={null}
          origin={{ ...trip.origin, name: trip.originName }}
          destination={{ ...trip.destination, name: trip.destinationName }}
          // O trajeto percorrido, e não a rota planejada: é o que o escopo
          // chama de "mapa do trajeto percorrido".
          routeCoordinates={hasPath ? trip.path : []}
          stops={trip.stops.map((stop) => stop.location)}
          showsUserLocation={false}
          interactive={false}
        />
      </View>

      <Card style={styles.metrics}>
        <SummaryMetric
          label="Distância"
          value={trip.distanceMeters !== null ? formatDistance(trip.distanceMeters) : '--'}
        />
        <View style={styles.metricDivider} />
        <SummaryMetric
          label="Duração"
          value={trip.durationSeconds !== null ? formatShortDuration(trip.durationSeconds) : '--'}
        />
        <View style={styles.metricDivider} />
        <SummaryMetric label="Paradas" value={String(trip.stopCount)} />
      </Card>

      <Card tone="muted" style={styles.insights}>
        <View style={styles.insightRow}>
          <Text variant="label" color="textSecondary">
            Maior trecho sem parada
          </Text>
          <Text variant="body">
            {trip.longestStretchWithoutStopSeconds !== null
              ? formatShortDuration(trip.longestStretchWithoutStopSeconds)
              : '--'}
          </Text>
        </View>
        <View style={styles.insightRow}>
          <Text variant="label" color="textSecondary">
            Emoção predominante
          </Text>
          <Text variant="body">
            {trip.predominantEmotion ? EMOTION_LABELS[trip.predominantEmotion] : '--'}
          </Text>
        </View>
        {touristSpots > 0 ? (
          <View style={styles.insightRow}>
            <Text variant="label" color="textSecondary">
              Locais registrados
            </Text>
            <Text variant="body">{touristSpots}</Text>
          </View>
        ) : null}
      </Card>

      {trip.endedAt === null ? (
        <StatusMessage tone="info" message="Esta viagem não foi encerrada pelo aplicativo." />
      ) : null}

      <View style={styles.section}>
        <SectionHeader title="Paradas" hint={String(trip.stops.length)} />
        {trip.stops.length === 0 ? (
          <Text variant="bodySoft" color="textSecondary">
            Nenhuma parada registrada.
          </Text>
        ) : (
          trip.stops.map((stop) => (
            <Card key={stop.id} tone="muted" style={styles.stop}>
              <Text variant="body">
                {stop.position}. {stop.name}
              </Text>
              {stop.reason ? (
                <Text variant="bodySoft" color="textSecondary">
                  {stop.reason}
                </Text>
              ) : null}
            </Card>
          ))
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Fotos" hint={String(trip.photos.length)} />
        <PhotoGallery photos={trip.photos} />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Diário de bordo" hint={String(trip.events.length)} />
        <JournalTimeline events={trip.events} />
      </View>
    </>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricItem}>
      <Text variant="label" color="textSecondary" align="center" numberOfLines={1}>
        {label}
      </Text>
      <Text variant="metric" align="center" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  titleBlock: {
    gap: 2,
  },
  map: {
    aspectRatio: 1.22,
    minHeight: 230,
  },
  metrics: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  metricItem: {
    flex: 1,
    gap: spacing.xs,
  },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: colors.border,
  },
  insights: {
    gap: spacing.sm,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  section: {
    gap: spacing.sm,
  },
  stop: {
    gap: 2,
    paddingVertical: spacing.md,
  },
});
