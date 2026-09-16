import { useLocalSearchParams } from 'expo-router';
import { useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StatusMessage } from '@/components/ui/status-message';
import { StatusPill } from '@/components/ui/status-pill';
import { useCurrentLocation } from '@/features/location/hooks/use-current-location';
import { AtlasMap, type AtlasMapHandle } from '@/features/map/components/atlas-map';
import type { NamedCoordinate } from '@/features/map/types/coordinate';
import { TripSummaryCard } from '@/features/trip/components/trip-summary-card';
import { DEMO_DESTINATION, DEMO_ORIGIN } from '@/features/trip/constants/demo-route';
import { useTripRoute } from '@/features/trip/hooks/use-trip-route';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { formatDistance } from '@/utils/distance';
import { formatDuration } from '@/utils/duration';

const EMPTY_ROUTE: never[] = [];

/**
 * Viagem em andamento: mapa com a rota desenhada e o resumo do trajeto.
 *
 * Tela empilhada sobre as abas — ocupa a tela inteira, sem barra inferior, e
 * traz o próprio botão de voltar. É aqui que a rota será desenvolvida.
 *
 * Cabe em uma tela, sem rolagem. O mapa é o único elemento elástico — cresce
 * para ocupar o que sobra entre o cabeçalho e o card, o que o mantém dominante
 * em telas grandes e ainda legível em aparelhos pequenos.
 *
 * A tela apenas compõe: localização, rota e apresentação vivem cada uma em sua
 * própria feature.
 */
export default function TripScreen() {
  const params = useLocalSearchParams<{
    name?: string;
    latitude?: string;
    longitude?: string;
  }>();

  /**
   * Destino escolhido na busca, quando houver. Coordenada inválida cai no
   * trajeto de demonstração em vez de derrubar a tela.
   */
  const destination = useMemo<NamedCoordinate>(() => {
    const latitude = Number(params.latitude);
    const longitude = Number(params.longitude);

    if (params.name && Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { name: params.name, latitude, longitude };
    }

    return DEMO_DESTINATION;
  }, [params.name, params.latitude, params.longitude]);

  /**
   * Dentro de `NativeTabs` o inset inferior já contempla a barra de abas — no
   * iOS ela é translúcida e o conteúdo passa por baixo dela. Sem este respiro,
   * o botão de centralizar fica atrás da barra.
   */
  const insets = useSafeAreaInsets();
  const mapRef = useRef<AtlasMapHandle>(null);

  const location = useCurrentLocation();

  /**
   * Origem da viagem: a posição do aparelho.
   *
   * Enquanto a localização está sendo resolvida o valor é `null`, e o cálculo
   * da rota espera — assim não gastamos uma consulta com uma origem
   * provisória para refazê-la um instante depois. Se o GPS falhar ou a
   * permissão for negada, cai no ponto de partida de demonstração, e a tela
   * continua funcionando.
   */
  const origin = useMemo<NamedCoordinate | null>(() => {
    if (location.isLoading) {
      return null;
    }

    if (location.coordinate) {
      return { ...location.coordinate, name: 'Sua localização' };
    }

    return DEMO_ORIGIN;
  }, [location.isLoading, location.coordinate]);

  /**
   * Quando a origem é a própria posição do aparelho, o indicador azul nativo
   * já a representa — um marcador em cima dele seria redundante.
   */
  const originIsUser = location.coordinate !== null;

  const trip = useTripRoute(origin, destination);

  const tripStatus = trip.route
    ? `${formatDistance(trip.route.distanceMeters)} • ${formatDuration(trip.route.durationSeconds)}`
    : trip.error
      ? 'Rota indisponível'
      : 'Calculando rota...';

  return (
    <View style={styles.screen}>
      <View style={[styles.body, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.pills}>
          <StatusPill
            icon="map-marker"
            title={origin ? origin.name : 'Obtendo origem...'}
            subtitle={`Em rota para ${destination.name}`}
          />
          <StatusPill
            dotColor={trip.error ? 'danger' : 'success'}
            tone={trip.error ? 'neutral' : 'positive'}
            titleColor={trip.error ? 'danger' : undefined}
            title={trip.error ? 'Rota com erro' : 'Rota calculada'}
            subtitle={tripStatus}
          />
        </View>

        <View style={styles.mapArea}>
          <AtlasMap
            ref={mapRef}
            currentLocation={location.coordinate}
            origin={origin ?? DEMO_ORIGIN}
            destination={destination}
            routeCoordinates={trip.route?.coordinates ?? EMPTY_ROUTE}
            showsUserLocation={location.coordinate !== null}
            showsOriginMarker={!originIsUser}
            onLocatePress={() => mapRef.current?.fitRoute()}
            badgeLabel={
              trip.route
                ? `${formatDistance(trip.route.distanceMeters)} até ${destination.name}`
                : undefined
            }
          />

          {/* Estados de localização flutuam sobre o mapa, sem empurrar o layout. */}
          {location.isLoading || location.error ? (
            <View style={styles.overlay} pointerEvents="box-none">
              {location.isLoading ? (
                <StatusMessage tone="info" message="Obtendo sua localização..." busy floating />
              ) : (
                <StatusMessage
                  tone="error"
                  message={location.error ?? ''}
                  onRetry={location.retry}
                  floating
                />
              )}
            </View>
          ) : null}
        </View>

        <TripSummaryCard
          origin={origin ?? DEMO_ORIGIN}
          destination={destination}
          route={trip.route}
          isLoading={trip.isLoading}
          error={trip.error}
          onRetry={trip.retry}
          onRecenter={() => mapRef.current?.fitRoute()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  pills: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  /** Único elemento elástico da tela. */
  mapArea: {
    flex: 1,
    minHeight: 180,
  },
  overlay: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: 64,
  },
});
