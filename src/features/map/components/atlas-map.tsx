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
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, type EdgePadding, type Region } from 'react-native-maps';

import { FloatingIconButton } from '@/components/ui/floating-icon-button';
import { Text } from '@/components/ui/text';
import { ATLAS_MAP_STYLE } from '@/features/map/constants/map-style';
import { NAVIGATION_CONFIG, ROUTE_COLORS } from '@/features/map/constants/navigation';
import type { Coordinate, NamedCoordinate } from '@/features/map/types/coordinate';
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
   * Heading do GPS em graus (0-360). Usado no modo `navigation` para
   * rotacionar o mapa na direção do movimento.
   */
  userHeading?: number | null;
  /**
   * Índice do ponto atual na rota. Usado no modo `navigation` para
   * dividir a polyline em trecho percorrido (opaco) e pendente (vibrante).
   */
  routeProgressIndex?: number;
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
}: AtlasMapProps) {
  const mapRef = useRef<MapView>(null);
  const [isMapReady, setIsMapReady] = useState(false);

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

  // Segmentos da rota para modo navigation (percorrido vs pendente)
  const completedCoords = useMemo(() => {
    if (focus !== 'navigation' || routeCoordinates.length < 2) return [];
    return routeCoordinates.slice(0, routeProgressIndex + 1);
  }, [focus, routeCoordinates, routeProgressIndex]);

  const pendingCoords = useMemo(() => {
    if (focus !== 'navigation' || routeCoordinates.length < 2) return [];
    return routeCoordinates.slice(routeProgressIndex);
  }, [focus, routeCoordinates, routeProgressIndex]);

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

  const goToNavigation = useCallback(() => {
    if (!currentLocation) {
      return;
    }

    // Calcula o deslocamento para efeito terceira pessoa
    const headingRad = (userHeading ?? 0) * (Math.PI / 180);
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLng = 111320 * Math.cos(currentLocation.latitude * Math.PI / 180);
    const offsetLat = (NAVIGATION_CONFIG.CAMERA_AHEAD_OFFSET / metersPerDegreeLat) * Math.cos(headingRad);
    const offsetLng = (NAVIGATION_CONFIG.CAMERA_AHEAD_OFFSET / metersPerDegreeLng) * Math.sin(headingRad);

    mapRef.current?.animateCamera(
      {
        center: {
          latitude: currentLocation.latitude + offsetLat,
          longitude: currentLocation.longitude + offsetLng,
        },
        pitch: NAVIGATION_CONFIG.PITCH,
        heading: userHeading ?? 0,
        zoom: NAVIGATION_CONFIG.ZOOM,
      },
      { duration: NAVIGATION_CONFIG.ANIMATION_MS },
    );
  }, [currentLocation, userHeading]);

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
   * Modo navegação 3D: câmera inclinada e rotacionada conforme heading.
   *
   * Usa `animateCamera` ao invés de `animateToRegion` para controlar
   * pitch (inclinação) e heading (rotação) da câmera.
   *
   * O centro da câmera é deslocado "à frente" do usuário na direção do
   * heading, criando um efeito de terceira pessoa onde o usuário aparece
   * na parte inferior da tela e a estrada é visível à frente.
   */
  useEffect(() => {
    if (focus !== 'navigation' || !isMapReady || !currentLocation) {
      return;
    }

    // Calcula o deslocamento em graus a partir de metros
    // 1 grau de latitude ≈ 111320 metros
    // 1 grau de longitude ≈ 111320 * cos(latitude) metros
    const headingRad = (userHeading ?? 0) * (Math.PI / 180);
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLng = 111320 * Math.cos(currentLocation.latitude * Math.PI / 180);

    // Desloca a câmera "à frente" do usuário na direção do heading
    const offsetLat = (NAVIGATION_CONFIG.CAMERA_AHEAD_OFFSET / metersPerDegreeLat) * Math.cos(headingRad);
    const offsetLng = (NAVIGATION_CONFIG.CAMERA_AHEAD_OFFSET / metersPerDegreeLng) * Math.sin(headingRad);

    mapRef.current?.animateCamera(
      {
        center: {
          latitude: currentLocation.latitude + offsetLat,
          longitude: currentLocation.longitude + offsetLng,
        },
        pitch: NAVIGATION_CONFIG.PITCH,
        heading: userHeading ?? 0,
        zoom: NAVIGATION_CONFIG.ZOOM,
      },
      { duration: NAVIGATION_CONFIG.ANIMATION_MS }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, isMapReady, currentLocation?.latitude, currentLocation?.longitude, userHeading]);

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
        {focus === 'navigation' && completedCoords.length >= 2 ? (
          <Polyline
            coordinates={completedCoords}
            strokeColor={ROUTE_COLORS.completed}
            strokeWidth={6}
            lineCap="round"
            lineJoin="round"
          />
        ) : null}

        {focus === 'navigation' && pendingCoords.length >= 2 ? (
          <Polyline
            coordinates={pendingCoords}
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
          Modo navegação: seta customizada que rotaciona conforme o heading.
          Substitui o ponto azul nativo para dar o efeito visual do Waze.
        */}
        {focus === 'navigation' && currentLocation ? (
          <Marker
            coordinate={currentLocation}
            anchor={{ x: 0.5, y: 0.5 }}
            flat
            rotation={Platform.OS === 'ios' ? 0 : (userHeading ?? 0)}
            tracksViewChanges={false}>
            <View
              style={[
                styles.arrowContainer,
                Platform.OS === 'ios' && { transform: [{ rotate: `${userHeading ?? 0}deg` }] },
              ]}>
              <MaterialCommunityIcons name="navigation" size={32} color={colors.primary} />
            </View>
          </Marker>
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
