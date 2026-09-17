import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StatusMessage } from '@/components/ui/status-message';
import { StatusPill } from '@/components/ui/status-pill';
import { useLocationTracking } from '@/features/location/hooks/use-location-tracking';
import { AtlasMap, type AtlasMapHandle } from '@/features/map/components/atlas-map';
import { TripProgressCard } from '@/features/trip/components/trip-progress-card';
import { DEMO_ORIGIN } from '@/features/trip/constants/demo-route';
import { useTripDestination } from '@/features/trip/hooks/use-trip-destination';
import { useTripOrigin } from '@/features/trip/hooks/use-trip-origin';
import { useTripProgress } from '@/features/trip/hooks/use-trip-progress';
import { useTripRoute } from '@/features/trip/hooks/use-trip-route';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { formatDistance } from '@/utils/distance';
import { formatDuration } from '@/utils/duration';

const EMPTY_ROUTE: never[] = [];

/**
 * Quanto tempo a rota inteira fica enquadrada antes de a câmera descer para o
 * acompanhamento.
 *
 * Existe porque as duas informações são necessárias em ordem: primeiro "para
 * onde eu vou", que só o trajeto inteiro responde, depois "onde eu estou
 * agora", que é o resto da viagem. Abrir direto no zoom fechado esconde a
 * primeira; nunca descer esconde a segunda.
 */
const OVERVIEW_HOLD_MS = 2_200;

/**
 * Viagem em andamento.
 *
 * Tela empilhada sobre as abas — ocupa a tela inteira, sem barra inferior, e
 * traz o próprio botão de voltar. Escolher um destino na busca abre direto
 * aqui: não há etapa de confirmação.
 *
 * O que a torna "em andamento" é o acompanhamento: a posição é rastreada
 * continuamente, a câmera segue o aparelho, e tempo, distância e progresso são
 * recalculados sobre a rota a cada leitura. A rota em si é calculada uma única
 * vez — recalcular quando o motorista desvia é a fase do turn-by-turn.
 *
 * Cabe em uma tela, sem rolagem. O mapa é o único elemento elástico — cresce
 * para ocupar o que sobra entre as pílulas e o card.
 *
 * A tela apenas compõe: localização, rota, progresso e apresentação vivem cada
 * um em sua própria feature.
 */
export default function TripScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<AtlasMapHandle>(null);

  const destination = useTripDestination();

  /**
   * Rastreamento contínuo, e não leitura única: é o que faz os números
   * descerem conforme o trajeto avança.
   */
  const tracking = useLocationTracking();

  /**
   * Origem da viagem: onde o aparelho estava quando a tela abriu.
   *
   * Congelada de propósito na primeira leitura. A posição segue mudando — é o
   * que o acompanhamento usa — mas o ponto de partida do trajeto é um só, e
   * deixá-lo seguir o aparelho recalcularia a rota a cada dez metros.
   */
  const origin = useTripOrigin(tracking.position?.coordinate ?? null, tracking.isStarting);

  const trip = useTripRoute(origin, destination);
  const progress = useTripProgress(trip.route, tracking.position?.coordinate ?? null);

  /**
   * Foco da câmera. Abre no trajeto inteiro e desce para o acompanhamento
   * sozinho; o botão do card alterna a qualquer momento.
   */
  const [isFollowing, setIsFollowing] = useState(false);

  // A contagem começa quando a rota chega, não quando a tela monta: antes
  // disso não há trajeto para enquadrar, e o tempo passaria em branco.
  useEffect(() => {
    if (!trip.route) {
      return;
    }

    const timeoutId = setTimeout(() => setIsFollowing(true), OVERVIEW_HOLD_MS);

    return () => clearTimeout(timeoutId);
  }, [trip.route]);

  const hasPosition = tracking.position !== null;

  const tripStatus = trip.route
    ? progress
      ? `Faltam ${formatDistance(progress.remainingMeters)} • ${formatDuration(progress.remainingSeconds)}`
      : `${formatDistance(trip.route.distanceMeters)} • ${formatDuration(trip.route.durationSeconds)}`
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
            title={trip.error ? 'Rota com erro' : progress ? 'Em viagem' : 'Rota calculada'}
            subtitle={tripStatus}
          />
        </View>

        <View style={styles.mapArea}>
          <AtlasMap
            ref={mapRef}
            currentLocation={tracking.position?.coordinate ?? null}
            origin={origin ?? DEMO_ORIGIN}
            destination={destination}
            routeCoordinates={trip.route?.coordinates ?? EMPTY_ROUTE}
            showsUserLocation={hasPosition}
            // Com a posição conhecida, o indicador azul nativo já marca a
            // origem — um pino em cima dele seria redundante.
            showsOriginMarker={!hasPosition}
            focus={isFollowing ? 'user' : 'route'}
            onLocatePress={() => {
              // O botão do mapa continua sendo "me mostre o trajeto", e por
              // isso sai do acompanhamento: senão a próxima leitura do GPS
              // desfaria o enquadramento em um segundo.
              setIsFollowing(false);
              mapRef.current?.fitRoute();
            }}
            locateLabel="Enquadrar o trajeto inteiro"
            badgeLabel={
              progress
                ? `${formatDistance(progress.remainingMeters)} restantes`
                : trip.route
                  ? `${formatDistance(trip.route.distanceMeters)} até ${destination.name}`
                  : undefined
            }
          />

          {/* Estados de localização flutuam sobre o mapa, sem empurrar o layout. */}
          {tracking.isStarting || (tracking.error && !hasPosition) ? (
            <View style={styles.overlay} pointerEvents="box-none">
              {tracking.isStarting ? (
                <StatusMessage tone="info" message="Obtendo sua localização..." busy floating />
              ) : (
                <StatusMessage
                  tone="error"
                  message={tracking.error ?? ''}
                  onRetry={tracking.retry}
                  floating
                />
              )}
            </View>
          ) : null}
        </View>

        <TripProgressCard
          destination={destination}
          route={trip.route}
          progress={progress}
          isLoadingRoute={trip.isLoading}
          routeError={trip.error}
          // Um erro de GPS com posição em mãos é só um aviso: o acompanhamento
          // continua a partir da última leitura boa.
          trackingError={hasPosition ? tracking.error : null}
          onRetryRoute={trip.retry}
          onEndTrip={() => router.back()}
          onToggleFocus={() => {
            setIsFollowing((following) => {
              if (following) {
                mapRef.current?.fitRoute();
              }
              return !following;
            });
          }}
          isFollowing={isFollowing}
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
