import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusMessage } from '@/components/ui/status-message';
import { Text } from '@/components/ui/text';
import { ContributionBars } from '@/features/recommendation/components/contribution-bars';
import {
  SCENARIO_PRESETS,
  ScenarioForm,
  type Scenario,
} from '@/features/recommendation/components/scenario-form';
import {
  describeRecommendationError,
  evaluateRecommendation,
} from '@/features/recommendation/services/recommendation-service';
import type { RecommendationResponse } from '@/features/recommendation/types/recommendation';
import { speak } from '@/features/voice/services/speech-output';
import { DECISION_LABELS } from '@/features/trip-session/constants/journal-labels';
import type { Decision } from '@/features/trip-session/types/trip';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

/**
 * Modo de demonstração do Random Forest.
 *
 * Ninguém vai dirigir 2h40 na apresentação. Aqui as 6 variáveis são trocadas
 * à mão e o **modelo de verdade** responde — com a decisão, a justificativa e
 * as barras que mostram quanto cada variável pesou (CA-16).
 *
 * Toda avaliação vai para o diário da viagem marcada como simulação, e nunca
 * entra no dataset real.
 */
export default function SimulatorScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tripId?: string; distanceMeters?: string }>();

  const [scenario, setScenario] = useState<Scenario>(SCENARIO_PRESETS[0].scenario);
  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const changeScenario = (next: Scenario) => {
    setScenario(next);
    setResult(null);
  };

  const evaluate = () => {
    if (!params.tripId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    evaluateRecommendation(params.tripId, {
      trigger: 'simulation',
      distanceMeters: Number(params.distanceMeters) || 0,
      simulation: scenario,
    })
      .then((response) => {
        setResult(response);
        const text = response.assistance
          ? 'Percebi tensão forte na sua voz. Quer ajuda?'
          : response.recommendation?.justification;
        if (text) {
          speak(text).catch(() => {});
        }
      })
      .catch((cause: unknown) => setError(describeRecommendationError(cause)))
      .finally(() => setIsLoading(false));
  };

  if (!params.tripId) {
    return (
      <View style={[styles.screen, styles.content]}>
        <StatusMessage
          tone="info"
          message="O simulador avalia dentro de uma viagem registrada. Inicie uma viagem com a API configurada."
        />
      </View>
    );
  }

  const recommendation = result?.recommendation;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
      showsVerticalScrollIndicator={false}>
      <Text variant="bodySoft" color="textSecondary">
        Troque as 6 variáveis e veja o que o Random Forest recomenda — e por quê. Fica registrado
        no diário como simulação.
      </Text>

      <ScenarioForm scenario={scenario} onChange={changeScenario} />

      <PrimaryButton
        label={isLoading ? 'Avaliando…' : 'Avaliar com o modelo'}
        icon="brain"
        showChevron={false}
        disabled={isLoading}
        onPress={evaluate}
      />

      {error ? <StatusMessage tone="error" message={error} /> : null}

      {result?.assistance ? (
        <StatusMessage
          tone="error"
          message="Tensão forte na voz: o Atlas oferece a emergência antes de consultar o modelo (§11)."
        />
      ) : null}

      {recommendation ? (
        <>
          <Card style={styles.result}>
            <Text variant="label" color="textSecondary">
              DECISÃO · {Math.round(recommendation.confidence * 100)}% DE CONFIANÇA
            </Text>
            <Text variant="title">{recommendation.label}</Text>
            <Text variant="bodySoft">{recommendation.justification}</Text>
          </Card>

          <View style={styles.section}>
            <SectionHeader title="Por que esta decisão" hint="contribuição" />
            <ContributionBars contributions={recommendation.contributions} />
          </View>

          <View style={styles.section}>
            <SectionHeader title="Probabilidade de cada decisão" />
            {(Object.entries(recommendation.probabilities) as [Decision, number][])
              .sort((a, b) => b[1] - a[1])
              .map(([decision, probability]) => (
                <View key={decision} style={styles.probability}>
                  <Text variant="bodySoft">{DECISION_LABELS[decision]}</Text>
                  <Text variant="body">{Math.round(probability * 100)}%</Text>
                </View>
              ))}
          </View>

          <Text variant="label" color="textSecondary">
            Modelo {recommendation.modelVersion}
          </Text>
        </>
      ) : null}
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
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  result: {
    gap: spacing.xs,
  },
  section: {
    gap: spacing.md,
  },
  probability: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
