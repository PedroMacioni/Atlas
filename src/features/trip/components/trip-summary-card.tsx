import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { MetricTile } from '@/components/ui/metric-tile';
import { PrimaryButton } from '@/components/ui/primary-button';
import { StatusMessage } from '@/components/ui/status-message';
import { Text } from '@/components/ui/text';
import type { NamedCoordinate } from '@/features/map/types/coordinate';
import type { RouteResult } from '@/features/routing/types/route-result';
import { spacing } from '@/theme/spacing';
import { formatDistance } from '@/utils/distance';
import { formatDuration } from '@/utils/duration';

export type TripSummaryCardProps = {
  origin: NamedCoordinate;
  destination: NamedCoordinate;
  route: RouteResult | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onRecenter: () => void;
};

/**
 * Resumo do trajeto: origem, destino, as duas métricas reais e a ação.
 *
 * Só exibe números que o serviço de rotas devolveu. Enquanto a consulta está
 * em andamento ou falhou, o card mostra o estado em vez de valores vazios —
 * e a recuperação do erro vive dentro da própria faixa de estado, o que mantém
 * o card com a mesma altura nos três casos.
 */
export function TripSummaryCard({
  origin,
  destination,
  route,
  isLoading,
  error,
  onRetry,
  onRecenter,
}: TripSummaryCardProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.route}>
        <Text variant="body" numberOfLines={1} style={styles.endpoint}>
          {origin.name}
        </Text>
        <Text variant="body" color="primary">
          →
        </Text>
        <Text variant="body" numberOfLines={1} style={styles.endpoint}>
          {destination.name}
        </Text>
      </View>

      {error ? (
        <StatusMessage tone="error" message={error} onRetry={onRetry} />
      ) : isLoading ? (
        <StatusMessage tone="info" message="Calculando rota..." busy />
      ) : route ? (
        <>
          <View style={styles.metrics}>
            <MetricTile
              icon="clock-outline"
              label="Tempo estimado"
              value={formatDuration(route.durationSeconds)}
            />
            <MetricTile
              icon="road-variant"
              label="Distância"
              value={formatDistance(route.distanceMeters)}
            />
          </View>

          <PrimaryButton
            label="Centralizar rota"
            icon="navigation-variant"
            onPress={onRecenter}
          />
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  route: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  endpoint: {
    flexShrink: 1,
  },
  metrics: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
