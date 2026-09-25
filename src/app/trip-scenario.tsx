import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/primary-button';
import { Text } from '@/components/ui/text';
import { setDemoScenario, useDemoScenario } from '@/features/demo/state/demo-scenario';
import { ScenarioForm } from '@/features/recommendation/components/scenario-form';
import { requestTripAction } from '@/features/trip/state/trip-action-request';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

/**
 * Condições da viagem de demonstração: troca as 6 variáveis e pede a
 * recomendação. A resposta aparece na própria viagem, sobre o mapa.
 */
export default function TripScenarioScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scenario = useDemoScenario();

  const evaluate = () => {
    requestTripAction('ask-recommendation');
    router.back();
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
      showsVerticalScrollIndicator={false}>
      <Text variant="heading" style={styles.title}>
        Condições da demonstração
      </Text>
      <Text variant="bodySoft" color="textSecondary">
        O Random Forest decide com estas 6 variáveis. Ajuste o que quiser e peça a recomendação —
        ela aparece no mapa, sobre a viagem.
      </Text>

      <ScenarioForm scenario={scenario} onChange={setDemoScenario} />

      <PrimaryButton
        label="Pedir recomendação ao Atlas"
        icon="brain"
        showChevron={false}
        onPress={evaluate}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  title: {
    textAlign: 'center',
  },
});
