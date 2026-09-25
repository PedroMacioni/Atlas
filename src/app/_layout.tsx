import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';
import { fontAssets, fontFamily } from '@/theme/typography';

SplashScreen.preventAutoHideAsync().catch(() => {
  // A splash pode já ter sido escondida num recarregamento; seguir é seguro.
});

/** Cabeçalho nativo das telas empilhadas, só com a fonte do tema. */
const STACK_OPTIONS = {
  headerShown: true,
  headerBackButtonDisplayMode: 'minimal',
  headerTintColor: colors.primary,
  headerTitleStyle: { fontFamily: fontFamily.bold, fontSize: 17, color: colors.text },
  headerStyle: { backgroundColor: colors.background },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.background },
} as const;

/**
 * Raiz da navegação: carrega as fontes, os provedores globais e a pilha de
 * telas. As abas ficam no grupo `(tabs)`; as outras telas (viagem, destino,
 * emergência...) abrem por cima delas.
 */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);

  useEffect(() => {
    // Só mostra a tela quando a fonte carregou (evita o "pulo" da fonte do sistema para a do app).
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    /* `GestureHandlerRootView` precisa envolver tudo para os gestos funcionarem (ex.: painel da viagem). */
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={STACK_OPTIONS}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="destination"
            options={{ title: 'Definir destino', headerStyle: { backgroundColor: colors.surfaceMuted } }}
          />
          <Stack.Screen
            name="presentation-destination"
            options={{ headerShown: false }}
          />
          {/* A viagem não tem cabeçalho: o mapa ocupa a tela toda e ela tem o próprio botão de voltar. */}
          <Stack.Screen name="trip" options={{ headerShown: false }} />
          <Stack.Screen
            name="trip-actions"
            options={{
              headerShown: false,
              presentation: 'formSheet',
              sheetAllowedDetents: [0.62],
              sheetGrabberVisible: true,
            }}
          />
          {/* As 6 variáveis da demonstração, por cima da viagem. */}
          <Stack.Screen
            name="trip-scenario"
            options={{
              headerShown: false,
              presentation: 'formSheet',
              sheetAllowedDetents: [0.9],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen name="history/[id]" options={{ title: 'Resumo da viagem' }} />
          <Stack.Screen name="simulator" options={{ title: 'Simulador do Random Forest' }} />
          {/* Emergência abre em folha por cima de qualquer tela (a viagem continua por baixo). */}
          <Stack.Screen
            name="emergency"
            options={{
              title: 'Emergência',
              presentation: 'formSheet',
              sheetAllowedDetents: [0.62, 1],
              sheetGrabberVisible: true,
            }}
          />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
