import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Ref,
} from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { AnimatedRegion, Marker, Polyline, type EdgePadding, type Region } from 'react-native-maps';

import { FloatingIconButton } from '@/components/ui/floating-icon-button';
import { Text } from '@/components/ui/text';
import { ATLAS_MAP_STYLE } from '@/features/map/constants/map-style';
import { NAVIGATION_CONFIG, ROUTE_COLORS } from '@/features/map/constants/navigation';
import type { Coordinate, NamedCoordinate } from '@/features/map/types/coordinate';
import { navigationSegments } from '@/features/map/utils/navigation-segments';
import { findNearestPointOnRoute } from '@/features/map/utils/route-progress';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { shadows } from '@/theme/shadows';
import { spacing } from '@/theme/spacing';

/** Métodos de câmera expostos para quem controla o mapa de fora. */
export type AtlasMapHandle = {
  /** Enquadra a rota inteira (ou os dois marcadores, se não houver rota). */
  fitRoute: () => void;
  /** Volta a câmera para a posição atual do usuário. */
  centerOnUser: () => void;
  /** Ativa a visão 3D de navegação próxima ao usuário. */
  goToNavigation: () => void;
};

export type AtlasMapProps = {
  ref?: Ref<AtlasMapHandle>;
  /** Posição do usuário. Conceito distinto da origem da viagem. */
  currentLocation: Coordinate | null;
  origin: NamedCoordinate;
  destination: NamedCoordinate;
  /** Geometria da rota. Vazia enquanto o cálculo não terminou. */
  routeCoordinates: Coordinate[];
  /** Liga o indicador azul nativo da plataforma. */
  showsUserLocation: boolean;
  /** Ação do botão circular flutuante. Omitir esconde o botão. */
  onLocatePress?: () => void;
  /** Descrição acessível do botão flutuante. */
  locateLabel?: string;
  /** Texto do chip sobre o mapa, por exemplo "18,6 km até Viracopos". */
  badgeLabel?: string;
  /** Desenha o marcador de origem. */
  showsOriginMarker?: boolean;
  /** Desenha o marcador de destino. */
  showsDestinationMarker?: boolean;
  /**
   * `route` mostra o trajeto inteiro; `user` acompanha a posição;
   * `navigation` usa a câmera 3D inclinada, girando com a direção.
   */
  focus?: 'route' | 'user' | 'navigation';
  /**
   * Direção do movimento em graus (0 = norte). No modo `navigation` gira a
   * câmera e a seta. Quem chama prefere o rumo da rua ao do celular.
   */
  userHeading?: number | null;
  /** Índice do ponto atual na rota. Divide a linha em trecho percorrido e trecho que falta. */
  routeProgressIndex?: number;
  routeProgressPoint?: Coordinate | null;
  /** `card` tem cantos arredondados; `full` ocupa a tela inteira (navegação). */
  shape?: 'card' | 'full';
  /** Espaço reservado nas bordas ao enquadrar a rota (para não ficar atrás dos painéis). */
  edgePadding?: Partial<EdgePadding>;
  /** Paradas registradas, desenhadas como marcadores numerados na ordem. */
  stops?: Coordinate[];
  /** `false` trava o mapa (sem arrastar nem zoom), para não atrapalhar a rolagem da tela. */
  interactive?: boolean;
};

/** Margens ao enquadrar a rota. */
const EDGE_PADDING: EdgePadding = {
  top: 72,
  right: 64,
  bottom: 72,
  left: 48,
};

/** Enquadramento ao centralizar na posição do usuário, sob demanda. */
const USER_FOCUS_DELTA = 0.045;

/** Zoom do acompanhamento contínuo: uma janela de uns 300–400 m. */
const FOLLOW_DELTA = 0.0025;

/** Duração das transições de câmera. */
const ANIMATION_MS = 450;

/** Região inicial, enquanto a rota ainda não chegou. */
function buildInitialRegion(origin: Coordinate, destination: Coordinate): Region {
  const latitude = (origin.latitude + destination.latitude) / 2;
  const longitude = (origin.longitude + destination.longitude) / 2;

  // Um respiro de 60% além da distância bruta entre os dois pontos.
  const latitudeDelta = Math.max(Math.abs(origin.latitude - destination.latitude) * 1.6, 0.05);
  const longitudeDelta = Math.max(Math.abs(origin.longitude - destination.longitude) * 1.6, 0.05);

  return { latitude, longitude, latitudeDelta, longitudeDelta };
}

/** Componente do mapa. Não busca dados: recebe tudo por props e só desenha. */
export function AtlasMap({
  ref,
  currentLocation,
  origin,
  destination,
  routeCoordinates,
  showsUserLocation,
  onLocatePress,
  locateLabel = 'Centralizar rota no mapa',
  badgeLabel,
  showsOriginMarker = true,
  showsDestinationMarker = true,
  focus = 'route',
  shape = 'card',
  edgePadding,
  stops,
  interactive = true,
  userHeading,
  routeProgressIndex = 0,
  routeProgressPoint,
}: AtlasMapProps) {
  const mapRef = useRef<MapView>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [animatedUserLocation] = useState(() => new AnimatedRegion({ ...(currentLocation ?? origin), latitudeDelta: 0, longitudeDelta: 0 }));
  const hasAnimatedUserLocation = useRef(false);

  useEffect(() => {
    if (focus !== 'navigation' || !currentLocation) {
      hasAnimatedUserLocation.current = false;
      return;
    }

    if (!hasAnimatedUserLocation.current) {
      animatedUserLocation.setValue({ ...currentLocation, latitudeDelta: 0, longitudeDelta: 0 });
      hasAnimatedUserLocation.current = true;
      return;
    }

    animatedUserLocation.timing({
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      latitudeDelta: 0,
      longitudeDelta: 0,
      duration: 110,
      useNativeDriver: false,
    } as Parameters<AnimatedRegion['timing']>[0]).start();
  }, [focus, currentLocation, animatedUserLocation]);

  const initialRegion = useMemo(() => {
    // Modo navegação: começa próximo ao usuário ou à origem
    if (focus === 'navigation') {
      const center = currentLocation ?? origin;
      return {
        ...center,
        latitudeDelta: FOLLOW_DELTA,
        longitudeDelta: FOLLOW_DELTA,
      };
    }
    // Modo acompanhamento: segue o usuário
    if (focus === 'user' && currentLocation) {
      return {
        ...currentLocation,
        latitudeDelta: FOLLOW_DELTA,
        longitudeDelta: FOLLOW_DELTA,
      };
    }
    // Modo rota: enquadra origem e destino
    return buildInitialRegion(origin, destination);
  }, [focus, currentLocation, origin, destination]);

  /**
   * Em que ponto da rota fica a parada aceita. A rota já passa por ela, então
   * basta achar o ponto mais próximo. `null` quando não há parada.
   */
  const stopOnRoute = useMemo(() => {
    const stop = stops?.[0];

    if (focus !== 'navigation' || !stop || routeCoordinates.length < 2) {
      return null;
    }

    return findNearestPointOnRoute(stop, routeCoordinates).index;
    // O progresso fica fora das dependências: a parada não muda de lugar a cada leitura do GPS.
  }, [focus, stops, routeCoordinates]);

  /** Some quando a parada fica para trás. */
  const stopIndex = stopOnRoute !== null && stopOnRoute > routeProgressIndex ? stopOnRoute : null;

  /** Trechos percorrido, até a parada e até o destino, cortados na posição do carro. */
  const segments = useMemo(() => {
    if (focus !== 'navigation' || routeCoordinates.length < 2) {
      return { completed: [], detour: [], pending: [] };
    }
    return navigationSegments(
      routeCoordinates,
      routeProgressIndex,
      routeProgressPoint ?? routeCoordinates[routeProgressIndex],
      stopIndex,
    );
  }, [focus, routeCoordinates, routeProgressIndex, routeProgressPoint, stopIndex]);

  const fitRoute = useCallback(() => {
    const points = routeCoordinates.length >= 2 ? routeCoordinates : [origin, destination];

    mapRef.current?.fitToCoordinates(points, {
      edgePadding: { ...EDGE_PADDING, ...edgePadding },
      animated: true,
    });
  }, [routeCoordinates, origin, destination, edgePadding]);

  const centerOnUser = useCallback(() => {
    if (!currentLocation) {
      return;
    }

    mapRef.current?.animateToRegion(
      {
        ...currentLocation,
        latitudeDelta: USER_FOCUS_DELTA,
        longitudeDelta: USER_FOCUS_DELTA,
      },
      ANIMATION_MS,
    );
  }, [currentLocation]);

  /**
   * Câmera de navegação: inclinada, girando com o movimento e centrada um pouco
   * À FRENTE do carro, para a estrada ocupar a tela.
   */
  const navigationCamera = useCallback(
    (at: Coordinate) => {
      const headingRad = (userHeading ?? 0) * (Math.PI / 180);
      const metersPerDegreeLat = 111320;
      const metersPerDegreeLng = 111320 * Math.cos((at.latitude * Math.PI) / 180);
      const offsetLat =
        (NAVIGATION_CONFIG.CAMERA_AHEAD_OFFSET / metersPerDegreeLat) * Math.cos(headingRad);
      const offsetLng =
        (NAVIGATION_CONFIG.CAMERA_AHEAD_OFFSET / metersPerDegreeLng) * Math.sin(headingRad);

      return {
        center: {
          latitude: at.latitude + offsetLat,
          longitude: at.longitude + offsetLng,
        },
        pitch: NAVIGATION_CONFIG.PITCH,
        heading: userHeading ?? 0,
        zoom: NAVIGATION_CONFIG.ZOOM,
      };
    },
    [userHeading],
  );

  const goToNavigation = useCallback(() => {
    if (!currentLocation) {
      return;
    }

    mapRef.current?.animateCamera(navigationCamera(currentLocation), {
      duration: NAVIGATION_CONFIG.ANIMATION_MS,
    });
  }, [currentLocation, navigationCamera]);

  useImperativeHandle(ref, () => ({ fitRoute, centerOnUser, goToNavigation }), [fitRoute, centerOnUser, goToNavigation]);

  // Enquadra a rota quando ela chega, mas só depois do mapa estar pronto.
  useEffect(() => {
    if (focus === 'route' && isMapReady && routeCoordinates.length >= 2) {
      fitRoute();
    }
  }, [focus, isMapReady, routeCoordinates, fitRoute]);

  /** Acompanha a posição quando o foco é o usuário. */
  useEffect(() => {
    if (focus !== 'user' || !isMapReady || !currentLocation) {
      return;
    }

    mapRef.current?.animateToRegion(
      {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: FOLLOW_DELTA,
        longitudeDelta: FOLLOW_DELTA,
      },
      ANIMATION_MS,
    );
    // Usa só latitude e longitude: o objeto muda a cada leitura mesmo com a posição igual.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, isMapReady, currentLocation?.latitude, currentLocation?.longitude]);

  /**
   * Acompanhamento no modo navegação.
   *
   * - A primeira posição não é animada: a câmera vai direto para lá (animar
   *   poderia atravessar o mapa inteiro).
   * - Depois, cada leitura anima a câmera por um tempo curto (entre 90 e
   *   180 ms, perto do intervalo entre as leituras) para o movimento ficar suave.
   */
  const hasCenteredOnUser = useRef(false);
  const lastCameraMoveAt = useRef<number | null>(null);

  useEffect(() => {
    if (focus !== 'navigation' || !isMapReady || !currentLocation) {
      return;
    }

    const camera = navigationCamera(currentLocation);
    const now = Date.now();
    const sinceLastMove = lastCameraMoveAt.current === null ? null : now - lastCameraMoveAt.current;
    lastCameraMoveAt.current = now;

    if (!hasCenteredOnUser.current) {
      hasCenteredOnUser.current = true;
      mapRef.current?.setCamera(camera);
      return;
    }

    mapRef.current?.animateCamera(camera, {
      duration: Math.min(180, Math.max(90, sinceLastMove ?? 110)),
    });
    // Usa só latitude e longitude, como no efeito acima.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, isMapReady, currentLocation?.latitude, currentLocation?.longitude, navigationCamera]);

  return (
    <View style={[styles.container, shape === 'card' ? styles.card : styles.full]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        customMapStyle={ATLAS_MAP_STYLE}
        onMapReady={() => setIsMapReady(true)}
        showsUserLocation={showsUserLocation}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={interactive}
        pitchEnabled={interactive}
        loadingEnabled
        loadingBackgroundColor={colors.surfaceMuted}
        loadingIndicatorColor={colors.primary}>
        {/* Modo navegação: duas linhas (percorrido e pendente) */}
        {focus === 'navigation' && segments.completed.length >= 2 ? (
          <Polyline
            coordinates={segments.completed}
            strokeColor={ROUTE_COLORS.completed}
            strokeWidth={6}
            lineCap="round"
            lineJoin="round"
          />
        ) : null}

        {segments.detour.length >= 2 ? (
          <Polyline
            coordinates={segments.detour}
            strokeColor={ROUTE_COLORS.detour}
            strokeWidth={6}
            lineCap="round"
            lineJoin="round"
          />
        ) : null}

        {focus === 'navigation' && segments.pending.length >= 2 ? (
          <Polyline
            coordinates={segments.pending}
            strokeColor={ROUTE_COLORS.pending}
            strokeWidth={6}
            lineCap="round"
            lineJoin="round"
          />
        ) : null}

        {/* Outros modos: uma linha só */}
        {focus !== 'navigation' && routeCoordinates.length >= 2 ? (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={colors.primary}
            strokeWidth={6}
            lineCap="round"
            lineJoin="round"
          />
        ) : null}

        {showsOriginMarker ? (
          <Marker
            coordinate={origin}
            title={origin.name}
            description="Origem da viagem"
            pinColor={colors.primary}
          />
        ) : null}

        {showsDestinationMarker ? (
          <Marker
            coordinate={destination}
            title={destination.name}
            description="Destino da viagem"
            pinColor={colors.danger}
          />
        ) : null}

        {stops?.map((stop, index) => (
          <Marker
            key={`${stop.latitude},${stop.longitude},${index}`}
            coordinate={stop}
            title={`Parada ${index + 1}`}
            pinColor={colors.categoryFood}
          />
        ))}

        {/*
          Modo navegação: seta própria no lugar do ponto azul nativo. `flat` deixa a
          seta "deitada" no mapa, girando junto com ele; `rotation` aponta para a
          direção da rua.
        */}
        {focus === 'navigation' && currentLocation ? (
          <Marker.Animated
            coordinate={animatedUserLocation as unknown as Coordinate}
            anchor={{ x: 0.5, y: 0.5 }}
            flat
            rotation={userHeading ?? 0}
            tracksViewChanges={false}>
            <View style={styles.arrowContainer}>
              <MaterialCommunityIcons name="navigation" size={32} color={colors.primary} />
            </View>
          </Marker.Animated>
        ) : null}

        {/*
          Com permissão, `showsUserLocation` já desenha o ponto azul nativo. Sem ele,
          mostramos um marcador simples. No modo navegação a seta substitui os dois.
        */}
        {focus !== 'navigation' && !showsUserLocation && currentLocation ? (
          <Marker coordinate={currentLocation} title="Você está aqui" pinColor={colors.primary} />
        ) : null}
      </MapView>

      {onLocatePress ? (
        <View style={styles.locateSlot}>
          <FloatingIconButton
            icon="navigation-variant"
            accessibilityLabel={locateLabel}
            onPress={onLocatePress}
          />
        </View>
      ) : null}

      {badgeLabel ? (
        <View style={styles.badge} pointerEvents="none">
          <MaterialCommunityIcons name="navigation-variant" size={16} color={colors.primary} />
          <Text variant="label" color="text" numberOfLines={1}>
            {badgeLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    /** Ocupa o espaço que a tela reservar (quem define a altura é o layout pai). */
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
  card: {
    borderRadius: radius.lg,
  },
  full: {
    borderRadius: 0,
  },
  locateSlot: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
  },
  badge: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  /** Fundo da seta de navegação, com sombra para destacar do mapa. */
  arrowContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.raised,
  },
});
