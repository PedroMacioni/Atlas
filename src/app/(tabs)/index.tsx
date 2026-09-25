import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingIconButton } from '@/components/ui/floating-icon-button';
import { SearchField } from '@/components/ui/search-field';
import { StatusMessage } from '@/components/ui/status-message';
import { useCurrentLocation } from '@/features/location/hooks/use-current-location';
import { AtlasMap, type AtlasMapHandle } from '@/features/map/components/atlas-map';
import { DEMO_DESTINATION, DEMO_ORIGIN } from '@/features/trip/constants/demo-route';
import { VoiceMapControl } from '@/features/voice/components/voice-map-control';
import { useHomeVoice } from '@/features/voice/hooks/use-home-voice';
import { useWakeWord } from '@/features/voice/hooks/use-wake-word';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

const EMPTY_ROUTE: never[] = [];

/** Mapa em tela cheia; a busca é a única entrada para iniciar uma viagem. */
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const location = useCurrentLocation();
  const mapRef = useRef<AtlasMapHandle>(null);

  const openEmergency = () =>
    router.push({
      pathname: '/emergency',
      params: location.coordinate
        ? {
            latitude: String(location.coordinate.latitude),
            longitude: String(location.coordinate.longitude),
          }
        : {},
    });

  const voice = useHomeVoice({
    goCategory: (category) =>
      router.push({ pathname: '/destination', params: { category, voice: '1' } }),
    goPlace: (text) => router.push({ pathname: '/destination', params: { query: text, voice: '1' } }),
    openEmergency,
  });

  const wake = useWakeWord({
    onWake: (rest) => voice.resume(rest),
    enabled: voice.state === 'idle',
  });

  const openSearch = () => router.push('/destination');

  return (
    <View style={styles.screen}>
      <AtlasMap
        ref={mapRef}
        currentLocation={location.coordinate}
        origin={DEMO_ORIGIN}
        destination={DEMO_DESTINATION}
        routeCoordinates={EMPTY_ROUTE}
        showsUserLocation={location.coordinate !== null}
        showsOriginMarker={false}
        showsDestinationMarker={false}
        focus="user"
        shape="full"
      />

      <View style={[styles.topControls, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <SearchField
          value=""
          onChangeText={() => {}}
          onPress={openSearch}
          placeholder="Para onde?"
          tone="floating"
        />

        <View style={styles.mapActions}>
          {voice.available ? (
            <VoiceMapControl
              state={voice.state}
              partial={voice.partial}
              watching={wake.watching}
              onPress={voice.onMicPress}
              onLongPress={wake.available ? wake.toggle : undefined}
            />
          ) : null}
          {/*
            Viagem de demonstração: Taquaral, em Campinas, até a São Paulo
            Expo, já na metade do caminho. É o que abre a tela de viagem em
            andamento sem precisar dirigir — para a apresentação, e para
            conferir na mão o que só apareceria depois de horas de estrada.
          */}
          <FloatingIconButton
            size="lg"
            icon="flask-outline"
            accessibilityLabel="Iniciar viagem de demonstração"
            onPress={() => router.push('/trip?demo=1')}
          />

          {/* Modo apresentação: demo guiado com 7 atos para gravação de vídeo */}
          <FloatingIconButton
            size="lg"
            icon="presentation-play"
            accessibilityLabel="Iniciar modo apresentação"
            onPress={() => router.push('/trip?presentation=1')}
          />

          <FloatingIconButton
            size="lg"
            icon="alarm-light"
            iconColor="danger"
            accessibilityLabel="Abrir emergência"
            onPress={openEmergency}
          />
        </View>
      </View>

      {location.error ? (
        <View style={[styles.error, { bottom: insets.bottom + spacing.md }]} pointerEvents="box-none">
          <StatusMessage
            tone="error"
            message={location.error}
            onRetry={location.retry}
            floating
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
  },
  topControls: {
    ...StyleSheet.absoluteFill,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  mapActions: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    gap: spacing.sm,
  },
  error: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
  },
});
