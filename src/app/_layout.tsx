import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';
import { fontAssets, fontFamily } from '@/theme/typography';

SplashScreen.preventAutoHideAsync().catch(() => {
  // A splash já pode ter sido dispensada num recarregamento; seguir é seguro.
});

/**
 * Cabeçalho nativo das telas empilhadas.
 *
 * O título e o botão de voltar são os da plataforma — seta e gesto do sistema
 * no iOS, `Toolbar` no Android. Só a tipografia é alinhada ao tema; nada é
 * redesenhado em JavaScript.
 */
const STACK_OPTIONS = {
  headerShown: true,
  headerBackTitle: 'Voltar',
  headerTintColor: colors.primary,
  headerTitleStyle: { fontFamily: fontFamily.bold, fontSize: 17, color: colors.text },
  headerStyle: { backgroundColor: colors.background },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.background },
} as const;

/**
 * Raiz da navegação.
 *
 * Mantém apenas composição: carregamento de fontes, provedores globais e a
 * pilha de telas. Nenhuma lógica de domínio vive aqui.
 *
 * A pilha tem dois níveis: o grupo `(tabs)`, com a barra de abas nativa, e as
 * telas que se empilham por cima dele — como a viagem, que ocupa a tela inteira
 * e tem o próprio botão de voltar.
 */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);

  useEffect(() => {
    // Só revela a interface quando a tipografia está pronta, para evitar o
    // salto visual da fonte de sistema para a Plus Jakarta Sans.
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={STACK_OPTIONS}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="destination" options={{ title: 'Definir destino' }} />
        {/*
          A viagem esconde o cabeçalho: o mapa encosta nas quatro bordas e a
          tela traz o próprio botão de voltar, sobre o mapa. Um cabeçalho ali
          roubaria a faixa onde vive a instrução de manobra.
        */}
        <Stack.Screen name="trip" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
