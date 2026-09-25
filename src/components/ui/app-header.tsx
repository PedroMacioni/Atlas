import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

/**
 * Cabeçalho com o nome ATLAS centralizado, usado nas abas.
 *
 * Respeita o recorte do topo da tela (notch, Dynamic Island, barra de status).
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
