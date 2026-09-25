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
   * `route` enquadra o trajeto inteiro; `user` acompanha a posição atual;
   * `navigation` ativa câmera 3D inclinada com rotação baseada no heading.
   */
  focus?: 'route' | 'user' | 'navigation';
  /**
   * Direção do movimento em graus (0-360), a partir do norte. No modo
   * `navigation` ela gira a câmera e a seta do usuário.
   *
   * Quem chama prefere o rumo da rota ao do aparelho: o do aparelho oscila
   * com o carro parado e some em velocidade baixa.
   */
  userHeading?: number | null;
  /**
   * Índice do ponto atual na rota. Usado no modo `navigation` para
   * dividir a polyline em trecho percorrido (opaco) e pendente (vibrante).
   */
  routeProgressIndex?: number;
  routeProgressPoint?: Coordinate | null;
  /**
   * `card` arredonda os cantos, para o mapa que convive com outros elementos.
   * `full` encosta nas bordas, para a navegação — onde o mapa é a tela, e não
   * um bloco dentro dela.
   */
  shape?: 'card' | 'full';
  /**
   * Respiro que a câmera reserva nas bordas ao enquadrar a rota.
   *
   * Na navegação a faixa de instrução e o painel inferior cobrem parte do
   * mapa, e sem esse ajuste o trajeto seria enquadrado atrás deles.
   */
  edgePadding?: Partial<EdgePadding>;
  /** Paradas registradas, desenhadas como marcadores numerados na ordem. */
  stops?: Coordinate[];
  /**
   * `false` congela o mapa (sem arrastar nem zoom). Para o mapa que vive
   * dentro de uma tela que rola, onde o gesto do mapa roubaria a rolagem.
   */
  interactive?: boolean;
};

/**
 * Espaçamento aplicado ao enquadrar a rota. Os valores são relativos ao mapa
 * e proporcionais o bastante para não esconder a Polyline atrás dos elementos
 * flutuantes em telas pequenas.
 */
const EDGE_PADDING: EdgePadding = {
  top: 72,
  right: 64,
  bottom: 72,
  left: 48,
};

/** Enquadramento ao centralizar na posição do usuário, sob demanda. */
const USER_FOCUS_DELTA = 0.045;

/**
 * Enquadramento do acompanhamento contínuo — mais fechado que o de
 * centralizar.
 *
 * Cerca de 300-400 metros de janela: próximo o bastante para parecer o Waze,
 * mostrando a próxima curva sem perder o contexto. No zoom de
 * `USER_FOCUS_DELTA` o carro pareceria imóvel.
 */
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

/**
 * Apresentação do mapa. Não busca dados e não conhece serviços: recebe tudo
 * por props e apenas desenha.
 */
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
   * Onde a parada aceita cai na rota.
   *
   * A rota já passa por ela — foi recalculada com a parada como ponto
   * intermediário —, então basta achar o vértice mais próximo para saber onde
   * o desvio termina. `null` quando não há parada.
   */
  const stopOnRoute = useMemo(() => {
    const stop = stops?.[0];

    if (focus !== 'navigation' || !stop || routeCoordinates.length < 2) {
      return null;
    }

    return findNearestPointOnRoute(stop, routeCoordinates).index;
    // Fora das dependências fica o progresso: ele muda a cada leitura, e
    // varrer a rota inteira quatro vezes por segundo para achar um ponto que
    // não saiu do lugar seria desperdício.
  }, [focus, stops, routeCoordinates]);

  /** Some assim que a parada fica para trás: o desvio acabou. */
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
   * A câmera de navegação: inclinada, girada com o movimento e centrada um
   * pouco **à frente** de quem dirige, para a estrada ocupar a tela e o carro
   * ficar na parte de baixo.
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

  // Enquadra a rota sozinho assim que ela chega — mas só depois que o mapa
  // nativo está montado, senão `fitToCoordinates` é ignorado silenciosamente.
  useEffect(() => {
    if (focus === 'route' && isMapReady && routeCoordinates.length >= 2) {
      fitRoute();
    }
  }, [focus, isMapReady, routeCoordinates, fitRoute]);

  /**
   * Acompanha a posição enquanto o foco é o usuário.
   *
   * A dependência é a coordenada em si, não o objeto: durante a viagem chega
   * uma leitura a cada dez metros, e reagir à identidade do objeto animaria a
   * câmera mesmo quando o aparelho reporta a mesma posição — o que acontece
   * com o carro parado.
   */
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
    // `currentLocation` inteiro fora das dependências é deliberado: as duas
    // coordenadas já cobrem tudo que o efeito lê, e o objeto muda de
    // identidade a cada leitura do GPS mesmo quando a posição é a mesma.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, isMapReady, currentLocation?.latitude, currentLocation?.longitude]);

  /**
   * Acompanhamento em modo navegação.
   *
   * Duas coisas separadas, e é a diferença entre elas que tirava a fluidez:
   *
   * - **A primeira posição não se anima.** Ela costuma estar longe do
   *   enquadramento inicial — no modo de demonstração, 58 km adiante — e
   *   animar até lá é uma viagem de câmera sobre o mapa inteiro, carregando
   *   telas de todo o caminho. `setCamera` põe a câmera no lugar de uma vez.
   * - **Depois, a animação dura o que durou o intervalo.** Cada leitura anima
   *   pelo tempo que separou as duas últimas, então a câmera ainda está
   *   chegando quando a próxima chega, e o movimento não tem buraco. Uma
   *   duração fixa, menor que o intervalo, é o que faz o mapa andar aos
   *   trancos.
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
    // `currentLocation` inteiro fora das dependências é deliberado: as duas
    // coordenadas já cobrem tudo que o efeito lê.
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
        {/* Modo navigation: duas polylines (percorrido + pendente) */}
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

        {/* Modos route/user: polyline única */}
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
          Modo navegação: seta customizada no lugar do ponto azul nativo.

          A rotação é uma só, pela prop `rotation` do marcador, e em graus a
          partir do norte **do mapa** — que é o que `flat` significa: o
          marcador está deitado sobre o mapa e gira com ele. Girar também a
          View por CSS somaria o giro da câmera ao do marcador, e a seta
          apontaria para qualquer lado menos o da rua.
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
          Com permissão concedida, `showsUserLocation` já desenha o ponto azul
          nativo da plataforma; não duplicamos um Marker. Sem permissão, nada
          é renderizado e `currentLocation` segue disponível para lógica de
          câmera futura.

          No modo navegação, a seta customizada substitui o ponto azul.
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
    /**
     * Preenche o espaço que a tela reservar. Quem decide a altura é o layout
     * pai, com flexbox — nunca `Dimensions.get`.
     */
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
  /** Container da seta de navegação com sombra para destacar do mapa. */
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
