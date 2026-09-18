import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/ui/app-header';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SecondaryButton } from '@/components/ui/secondary-button';
import { StatusMessage } from '@/components/ui/status-message';
import { StatusPill } from '@/components/ui/status-pill';
import { VoicePromptCard } from '@/components/ui/voice-prompt-card';
import { useCurrentLocation } from '@/features/location/hooks/use-current-location';
import { useHomeVoice } from '@/features/voice/hooks/use-home-voice';
import { AtlasMap, type AtlasMapHandle } from '@/features/map/components/atlas-map';
import { DEMO_DESTINATION, DEMO_ORIGIN } from '@/features/trip/constants/demo-route';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

const EMPTY_ROUTE: never[] = [];

/**
 * Tela de entrada do Atlas.
 *
 * Boas-vindas, não operação: mostra onde o usuário está e convida a começar.
 * O trajeto, a rota e as métricas vivem na tela de viagem — esta tela não
 * consulta o serviço de rotas, só a localização.
 *
 * Cabe em uma tela sem rolagem. O mapa é o único elemento elástico, então
 * encolhe sozinho para dar lugar ao botão e ao bloco de voz.
 */
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

  // "Atlas, quero ir para o posto mais próximo" (RF-03, RF-05, RF-06).
  const voice = useHomeVoice({
    goCategory: (category) =>
      router.push({ pathname: '/destination', params: { category, voice: '1' } }),
    goPlace: (query) => router.push({ pathname: '/destination', params: { query, voice: '1' } }),
    openEmergency,
  });

  return (
    <View style={styles.screen}>
      <AppHeader />

      <View style={[styles.body, { paddingBottom: insets.bottom + spacing.sm }]}>
        <View style={styles.pills}>
          <StatusPill
            icon="map-marker"
            title={location.coordinate ? 'Localização ativa' : 'Localização indisponível'}
            subtitle={
              location.isLoading
                ? 'Obtendo sua posição...'
                : location.coordinate
                  ? 'Sua localização atual'
                  : 'O mapa segue utilizável'
            }
          />
          <StatusPill
            dotColor={location.coordinate ? 'success' : 'danger'}
            tone={location.coordinate ? 'positive' : 'neutral'}
            titleColor={location.coordinate ? undefined : 'danger'}
            title={location.coordinate ? 'Tudo certo' : 'Sem GPS'}
            subtitle={location.coordinate ? 'Pronto para viajar' : 'Verifique a permissão'}
          />
        </View>

        <View style={styles.stack}>
          <View style={styles.mapArea}>
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
              locateLabel="Centralizar na minha localização"
              onLocatePress={
                /* Sem coordenada não há para onde centralizar; o botão nem aparece. */
                location.coordinate ? () => mapRef.current?.centerOnUser() : undefined
              }
            />

            {location.error ? (
              <View style={styles.overlay} pointerEvents="box-none">
                <StatusMessage
                  tone="error"
                  message={location.error}
                  onRetry={location.retry}
                  floating
                />
              </View>
            ) : null}
          </View>

          <PrimaryButton
            label="Iniciar nova viagem"
            icon="navigation-variant"
            onPress={() => router.push('/destination')}
          />

          <VoicePromptCard
            title={
              voice.state === 'listening'
                ? voice.partial || 'Ouvindo…'
                : 'Toque e diga "Atlas" para começar'
            }
            subtitle={voice.error ?? 'Ex.: "quero ir para o posto mais próximo"'}
            listening={voice.state === 'listening'}
            onPress={voice.available ? voice.onMicPress : undefined}
          />

          {/* Acesso rápido à emergência, também fora de viagem (§11). */}
          <SecondaryButton
            label="Emergência"
            tone="danger"
            onPress={openEmergency}
          />
        </View>
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
  /**
   * Mapa, ação principal e bloco de voz formam um grupo único, com respiro
   * menor entre si do que o que os separa das pílulas de estado.
   */
  stack: {
    gap: spacing.sm,
  },
  pills: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  /**
   * Proporção fixa em vez de esticar: a altura acompanha a largura do aparelho
   * (sem `Dimensions.get`) e o mapa não engorda quando sobra espaço. Encolhe
   * se a tela for apertada, mas nunca abaixo de `minHeight`.
   */
  mapArea: {
    aspectRatio: 16 / 11,
    flexShrink: 1,
    minHeight: 140,
  },
  overlay: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    right: spacing.md,
  },
});
