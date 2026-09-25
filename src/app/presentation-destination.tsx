import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlaceRow } from '@/components/ui/place-row';
import { SearchField } from '@/components/ui/search-field';
import { SectionHeader } from '@/components/ui/section-header';
import { Text } from '@/components/ui/text';
import { DEV_MODE } from '@/config/flags';
import { DEMO_DRIVE_DESTINATION } from '@/features/demo/constants/demo-drive';
import { IntroScreen } from '@/features/presentation/components/intro-screen';
import { CaptionBar } from '@/features/presentation/components/caption-bar';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

/** Fora do `EXPO_PUBLIC_DEV_MODE`, a rota não existe: volta para o início. */
export default function PresentationDestinationRoute() {
  return DEV_MODE ? <PresentationDestinationScreen /> : <Redirect href="/" />;
}

/** A primeira cena da gravação: splash do Atlas, depois seleção de destino. */
function PresentationDestinationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const started = useRef(false);
  const [showSplash, setShowSplash] = useState(true);

  const startTrip = useCallback(() => {
    if (started.current) return;
    started.current = true;
    router.replace('/trip?presentation=1&skipIntro=1');
  }, [router]);

  // Fase 1: Splash por 3.5 segundos
  useEffect(() => {
    const splashTimeout = setTimeout(() => {
      setShowSplash(false);
    }, 3500);
    return () => clearTimeout(splashTimeout);
  }, []);

  // Fase 2: Seleção de destino por 4 segundos após o splash
  useEffect(() => {
    if (!showSplash) {
      const tripTimeout = setTimeout(startTrip, 4000);
      return () => clearTimeout(tripTimeout);
    }
  }, [showSplash, startTrip]);

  return (
    <View style={styles.screen}>
      {/* Splash screen do Atlas */}
      <IntroScreen visible={showSplash} />

      {/* Conteúdo de seleção de destino */}
      {!showSplash && (
        <>
          <View style={[styles.content, { paddingTop: insets.top + spacing.lg }]}>
            <SearchField
              value={DEMO_DRIVE_DESTINATION.name}
              onChangeText={() => {}}
              placeholder="Para onde?"
              voiceDisabled
              tone="floating"
            />
            <View style={styles.heading}>
              <SectionHeader title="Destino selecionado" />
              <Text variant="bodySoft">Sua viagem começa em Campinas.</Text>
            </View>
            <PlaceRow
              icon="map-marker"
              title={DEMO_DRIVE_DESTINATION.name}
              subtitle="São Paulo, SP"
              onPress={startTrip}
            />
          </View>
          <View style={styles.captionContainer}>
            <CaptionBar
              text="Escolha seu destino para iniciar a viagem."
              title="Destino"
              step={1}
              total={10}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  heading: {
    gap: spacing.xs,
  },
  captionContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 180,
    zIndex: 60,
  },
});
