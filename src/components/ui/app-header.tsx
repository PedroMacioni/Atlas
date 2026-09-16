import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

/**
 * Cabeçalho da marca, com o wordmark centralizado.
 *
 * Usado apenas nas abas. Telas empilhadas usam o cabeçalho nativo do `Stack`,
 * com o botão de voltar e o gesto da própria plataforma.
 *
 * Respeita o recorte superior (Dynamic Island, notch, barra de status do
 * Android) via `useSafeAreaInsets` — sem `SafeAreaView`.
 */
export function AppHeader() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xs }]}>
      <Text variant="wordmark" align="center">
        ATLAS
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
});
