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
import MapView, { Marker, Polyline, type EdgePadding, type Region } from 'react-native-maps';

import { FloatingIconButton } from '@/components/ui/floating-icon-button';
import { Text } from '@/components/ui/text';
import { ATLAS_MAP_STYLE } from '@/features/map/constants/map-style';
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
   * `route` enquadra o trajeto inteiro; `user` acompanha a posição atual,
   * reposicionando a câmera a cada leitura nova.
   */
  focus?: 'route' | 'user';
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
 * Cerca de um quilômetro de janela: largo o bastante para mostrar a próxima
 * curva, fechado o bastante para o deslocamento ser perceptível. No zoom de
 * `USER_FOCUS_DELTA` o carro pareceria imóvel.
 */
const FOLLOW_DELTA = 0.01;

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
}: AtlasMapProps) {
  const mapRef = useRef<MapView>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  const initialRegion = useMemo(() => {
    if (focus === 'user' && currentLocation) {
      return {
        ...currentLocation,
        latitudeDelta: FOLLOW_DELTA,
        longitudeDelta: FOLLOW_DELTA,
      };
    }
    return buildInitialRegion(origin, destination);
  }, [focus, currentLocation, origin, destination]);

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

  useImperativeHandle(ref, () => ({ fitRoute, centerOnUser }), [fitRoute, centerOnUser]);

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
        loadingEnabled
        loadingBackgroundColor={colors.surfaceMuted}
        loadingIndicatorColor={colors.primary}>
        {routeCoordinates.length >= 2 ? (
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

        {/*
          Com permissão concedida, `showsUserLocation` já desenha o ponto azul
          nativo da plataforma; não duplicamos um Marker. Sem permissão, nada
          é renderizado e `currentLocation` segue disponível para lógica de
          câmera futura.
        */}
        {!showsUserLocation && currentLocation ? (
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
});
