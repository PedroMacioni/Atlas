import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { MetricTile } from '@/components/ui/metric-tile';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { SecondaryButton } from '@/components/ui/secondary-button';
import { StatusMessage } from '@/components/ui/status-message';
import { Text } from '@/components/ui/text';
import type { NamedCoordinate } from '@/features/map/types/coordinate';
import type { RouteResult } from '@/features/routing/types/route-result';
import type { TripProgress } from '@/features/trip/utils/trip-progress';
import { spacing } from '@/theme/spacing';
import { formatDistance } from '@/utils/distance';
import { formatDuration } from '@/utils/duration';

export type TripProgressCardProps = {
  destination: NamedCoordinate;
  route: RouteResult | null;
  /** Progresso sobre a rota, ou `null` antes da primeira posição. */
  progress: TripProgress | null;
  isLoadingRoute: boolean;
  routeError: string | null;
  /** Aviso de GPS — não bloqueia a tela, a rota continua visível. */
  trackingError: string | null;
  onRetryRoute: () => void;
  onEndTrip: () => void;
  /** Alterna entre acompanhar a posição e ver o trajeto inteiro. */
  onToggleFocus: () => void;
  isFollowing: boolean;
};

/**
 * Painel da viagem em andamento.
 *
 * Mostra o que resta, não o que foi contratado: os números caem conforme o
 * trajeto avança. Antes da primeira posição — e quando o GPS não responde —
 * cai para os totais da rota, porque um valor honesto do trajeto inteiro é
 * melhor que um campo vazio esperando satélite.
 *
 * Mantém altura estável nos três estados (carregando, erro, em viagem) para a
 * tela não pular: o mapa é o único elemento elástico.
 */
export function TripProgressCard({
  destination,
  route,
  progress,
  isLoadingRoute,
  routeError,
  trackingError,
  onRetryRoute,
  onEndTrip,
  onToggleFocus,
  isFollowing,
}: TripProgressCardProps) {
  if (routeError) {
    return (
      <Card style={styles.card}>
        <Text variant="body" numberOfLines={1}>
          {destination.name}
        </Text>
        <StatusMessage tone="error" message={routeError} onRetry={onRetryRoute} />
      </Card>
    );
  }

  if (isLoadingRoute || !route) {
    return (
      <Card style={styles.card}>
        <Text variant="body" numberOfLines={1}>
          {destination.name}
        </Text>
        <StatusMessage tone="info" message="Calculando rota..." busy />
      </Card>
    );
  }

  if (progress?.hasArrived) {
    return (
      <Card style={styles.card}>
        <Text variant="heading">Você chegou</Text>
        <Text variant="bodySoft" color="textSecondary" numberOfLines={2}>
          {destination.name}
        </Text>
        <PrimaryButton label="Encerrar viagem" icon="flag-checkered" onPress={onEndTrip} />
      </Card>
    );
  }

  // Sem posição ainda: os totais da rota são a melhor verdade disponível.
  const remainingMeters = progress?.remainingMeters ?? route.distanceMeters;
  const remainingSeconds = progress?.remainingSeconds ?? route.durationSeconds;
  const fraction = progress?.fraction ?? 0;

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text variant="body" numberOfLines={1} style={styles.destination}>
          {destination.name}
        </Text>
        <Text variant="label" color="textSecondary">
          {Math.round(fraction * 100)}%
        </Text>
      </View>

      <ProgressBar
        value={fraction}
        accessibilityLabel={`Progresso da viagem até ${destination.name}`}
      />

      <View style={styles.metrics}>
        <MetricTile
          icon="clock-outline"
          label="Tempo restante"
          value={formatDuration(remainingSeconds)}
        />
        <MetricTile
          icon="road-variant"
          label="Distância restante"
          value={formatDistance(remainingMeters)}
        />
      </View>

      {/*
        O desvio é um aviso, não um erro: o progresso congela porque deixou de
        ser confiável, mas a rota segue desenhada e o destino segue o mesmo.
        Recalcular o trajeto é a fase do turn-by-turn.
      */}
      {progress?.isOffRoute ? (
        <StatusMessage
          tone="info"
          message={`Você está a ${formatDistance(progress.offRouteMeters)} da rota.`}
        />
      ) : null}

      {trackingError ? <StatusMessage tone="error" message={trackingError} /> : null}

      {/*
        Os dois controles não têm largura própria, então cada um recebe a sua
        fatia da linha aqui — a ação de focar pesa mais que a de encerrar.
      */}
      <View style={styles.actions}>
        <View style={styles.primaryAction}>
          <PrimaryButton
            label={isFollowing ? 'Ver trajeto' : 'Me acompanhar'}
            icon={isFollowing ? 'map-outline' : 'crosshairs-gps'}
            showChevron={false}
            onPress={onToggleFocus}
          />
        </View>
        <View style={styles.endAction}>
          <SecondaryButton label="Encerrar" onPress={onEndTrip} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  destination: {
    flexShrink: 1,
  },
  metrics: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  primaryAction: {
    flexGrow: 2,
    flexShrink: 1,
    flexBasis: 0,
  },
  endAction: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
  },
});
