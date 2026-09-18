import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingIconButton } from '@/components/ui/floating-icon-button';
import { StatusMessage } from '@/components/ui/status-message';
import { Text } from '@/components/ui/text';
import { useLocationTracking } from '@/features/location/hooks/use-location-tracking';
import { AtlasMap, type AtlasMapHandle } from '@/features/map/components/atlas-map';
import { ManeuverBanner } from '@/features/trip/components/maneuver-banner';
import { TripBottomSheet } from '@/features/trip/components/trip-bottom-sheet';
import { DEMO_ORIGIN } from '@/features/trip/constants/demo-route';
import { useTripDestination } from '@/features/trip/hooks/use-trip-destination';
import { useTripOrigin } from '@/features/trip/hooks/use-trip-origin';
import { useTripProgress } from '@/features/trip/hooks/use-trip-progress';
import { useTripRoute } from '@/features/trip/hooks/use-trip-route';
import { findNextManeuver } from '@/features/trip/utils/next-maneuver';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { shadows } from '@/theme/shadows';
import { spacing } from '@/theme/spacing';

const EMPTY_ROUTE: never[] = [];

/**
 * Quanto tempo a rota inteira fica enquadrada antes de a câmera descer para o
 * acompanhamento.
 *
 * Existe porque as duas informações são necessárias em ordem: primeiro "para
 * onde eu vou", que só o trajeto inteiro responde, depois "onde eu estou
 * agora", que é o resto da viagem.
 */
const OVERVIEW_HOLD_MS = 2_200;

/**
 * Respiro que a câmera reserva ao enquadrar a rota.
 *
 * A faixa de instrução e o painel inferior cobrem parte do mapa; sem isso o
 * trajeto seria enquadrado atrás deles.
 */
const MAP_EDGE_PADDING = { top: 150, bottom: 210, left: 56, right: 56 };

/**
 * Viagem em andamento.
 *
 * O mapa **é** a tela: encosta nas quatro bordas, e o resto flutua sobre ele —
 * a instrução da próxima manobra no topo, o painel de chegada embaixo. É o
 * arranjo dos aplicativos de navegação, e a razão é a mesma: dirigindo, o que
 * se olha é o mapa, e todo o resto precisa caber na periferia da atenção.
 *
 * Por isso o cabeçalho nativo sai daqui (`headerShown: false`, em
 * `_layout.tsx`) e a tela traz o próprio botão de voltar.
 *
 * O painel inferior responde à pergunta que se faz numa viagem — **a que horas
 * eu chego?** — e por isso o horário vem primeiro, centralizado. Tempo e
 * distância ficam abaixo, menores, separados por um ponto.
 *
 * A tela apenas compõe: localização, rota, progresso, manobras e apresentação
 * vivem cada um em sua própria feature.
 */
export default function TripScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<AtlasMapHandle>(null);

  const destination = useTripDestination();
  const tracking = useLocationTracking();
  const origin = useTripOrigin(tracking.position?.coordinate ?? null, tracking.isStarting);

  const trip = useTripRoute(origin, destination);
  const progress = useTripProgress(trip.route, tracking.position?.coordinate ?? null);

  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (!trip.route) {
      return;
    }

    const timeoutId = setTimeout(() => setIsFollowing(true), OVERVIEW_HOLD_MS);

    return () => clearTimeout(timeoutId);
  }, [trip.route]);

  /**
   * Próxima manobra à frente.
   *
   * Depende do quanto já foi percorrido, e por isso só existe depois da
   * primeira posição — antes dela a instrução seria a de partida, que não
   * orienta ninguém.
   */
  const nextManeuver = useMemo(() => {
    if (!trip.route || !progress) {
      return null;
    }

    return findNextManeuver(trip.route.steps, progress.traveledMeters);
  }, [trip.route, progress]);

  const hasPosition = tracking.position !== null;
  const hasArrived = progress?.hasArrived ?? false;

  // Sem posição, os totais do trajeto são a melhor verdade disponível.
  const remainingMeters = progress?.remainingMeters ?? trip.route?.distanceMeters ?? 0;
  const remainingSeconds = progress?.remainingSeconds ?? trip.route?.durationSeconds ?? 0;

  const toggleFocus = () => {
    setIsFollowing((following) => {
      if (following) {
        mapRef.current?.fitRoute();
      }
      return !following;
    });
  };

  return (
    <View style={styles.screen}>
      <AtlasMap
        ref={mapRef}
        shape="full"
        edgePadding={MAP_EDGE_PADDING}
        currentLocation={tracking.position?.coordinate ?? null}
        origin={origin ?? DEMO_ORIGIN}
        destination={destination}
        routeCoordinates={trip.route?.coordinates ?? EMPTY_ROUTE}
        showsUserLocation={hasPosition}
        showsOriginMarker={!hasPosition}
        focus={isFollowing ? 'user' : 'route'}
      />

      {/* Camada de controles. `box-none` deixa o arrasto do mapa passar. */}
      <View style={styles.overlay} pointerEvents="box-none">
        <View
          style={[styles.top, { paddingTop: insets.top + spacing.sm }]}
          pointerEvents="box-none">
          <View style={styles.topRow} pointerEvents="box-none">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed && styles.backPressed]}>
              <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
            </Pressable>

            {/*
              A instrução ocupa o resto da linha. Sem manobra em mãos, a faixa
              mostra o destino: um espaço reservado e vazio seria pior que uma
              faixa que diz para onde se vai.
            */}
            <View style={styles.bannerSlot}>
              {nextManeuver && !hasArrived ? (
                <ManeuverBanner maneuver={nextManeuver} />
              ) : (
                <View style={[styles.plainBanner, shadows.raised]}>
                  <Text variant="body" numberOfLines={1}>
                    {hasArrived ? 'Você chegou' : `Em rota para ${destination.name}`}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Avisos empilham sob a faixa, sem empurrar o mapa. */}
          {trip.error ? (
            <StatusMessage tone="error" message={trip.error} onRetry={trip.retry} floating />
          ) : trip.isLoading ? (
            <StatusMessage tone="info" message="Calculando rota..." busy floating />
          ) : null}

          {tracking.isStarting ? (
            <StatusMessage tone="info" message="Obtendo sua localização..." busy floating />
          ) : tracking.error ? (
            <StatusMessage
              tone="error"
              message={tracking.error}
              // Com posição em mãos o erro é passageiro e o acompanhamento
              // segue da última leitura boa; sem ela, vale oferecer a retomada.
              onRetry={hasPosition ? undefined : tracking.retry}
              floating
            />
          ) : null}

          {progress?.isOffRoute ? (
            <StatusMessage tone="info" message="Você saiu da rota." floating />
          ) : null}

          {/*
            O controle de câmera é um ícone sobre o mapa, e não um botão no
            painel: é onde os aplicativos de navegação o colocam. Fica no alto,
            à direita, logo abaixo dos avisos — assim nunca cobre a faixa de
            instrução, que é o elemento mais importante da tela.
          */}
          <View style={styles.mapActions} pointerEvents="box-none">
            <FloatingIconButton
              size="lg"
              icon={isFollowing ? 'map-outline' : 'crosshairs-gps'}
              accessibilityLabel={
                isFollowing
                  ? 'Ver o trajeto inteiro no mapa'
                  : 'Voltar a acompanhar minha posição'
              }
              onPress={toggleFocus}
            />
          </View>
        </View>

        <TripBottomSheet
          remainingSeconds={remainingSeconds}
          remainingMeters={remainingMeters}
          bottomInset={insets.bottom}
          onEndTrip={() => router.back()}
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
  /**
   * Cobre o mapa inteiro e distribui os dois blocos — controles no topo,
   * painel no rodapé — com o espaço livre no meio, que é onde o mapa fica
   * visível e arrastável.
   */
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
  },
  top: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.raised,
  },
  backPressed: {
    opacity: 0.7,
  },
  bannerSlot: {
    flex: 1,
  },
  /** Alinha o controle de câmera à direita, sob a faixa de instrução. */
  mapActions: {
    alignItems: 'flex-end',
    paddingTop: spacing.xs,
  },
  /** Faixa de contexto quando não há manobra para anunciar. */
  plainBanner: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    minHeight: 44,
  },
});
