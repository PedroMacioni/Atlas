import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusMessage } from '@/components/ui/status-message';
import { Text } from '@/components/ui/text';
import { ContributionBars } from '@/features/recommendation/components/contribution-bars';
import {
  describeRecommendationError,
  evaluateRecommendation,
} from '@/features/recommendation/services/recommendation-service';
import type {
  RecommendationResponse,
  SimulationOverrides,
} from '@/features/recommendation/types/recommendation';
import { speak } from '@/features/voice/services/speech-output';
import {
  DECISION_LABELS,
  EMOTION_LABELS,
  IMAGE_CLASS_LABELS,
} from '@/features/trip-session/constants/journal-labels';
import type { Decision } from '@/features/trip-session/types/trip';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';

type Scenario = Required<Omit<SimulationOverrides, 'emotionConfidence'>> & {
  emotionConfidence?: number;
};

/**
 * Cenários prontos para a apresentação. O primeiro é o do escopo (§19,
 * Cenário 3): cansaço e muito tempo sem parar.
 */
const PRESETS: { name: string; scenario: Scenario }[] = [
  {
    name: 'Cenário 3 do escopo',
    scenario: {
      hour: 15,
      tripMinutes: 160,
      distanceKm: 190,
      minutesSinceStop: 130,
      emotion: 'cansado',
      image: 'estrada',
    },
  },
  {
    name: 'Posto à vista',
    scenario: {
      hour: 10,
      tripMinutes: 330,
      distanceKm: 300,
      minutesSinceStop: 40,
      emotion: 'neutro',
      image: 'posto',
    },
  },
  {
    name: 'Hora do almoço',
    scenario: {
      hour: 12.5,
      tripMinutes: 150,
      distanceKm: 140,
      minutesSinceStop: 125,
      emotion: 'neutro',
      image: 'estrada',
    },
  },
  {
    name: 'Paisagem',
    scenario: {
      hour: 14,
      tripMinutes: 70,
      distanceKm: 60,
      minutesSinceStop: 30,
      emotion: 'animado',
      image: 'ponto_turistico',
    },
  },
  {
    name: 'Tensão forte',
    scenario: {
      hour: 17,
      tripMinutes: 90,
      distanceKm: 80,
      minutesSinceStop: 75,
      emotion: 'tenso',
      emotionConfidence: 0.95,
      image: 'estrada',
    },
  },
];

const EMOTIONS = ['desconhecido', 'cansado', 'neutro', 'animado', 'tenso', 'bravo'] as const;
const IMAGES = ['desconhecida', 'estrada', 'posto', 'restaurante', 'ponto_turistico'] as const;

function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h${String(rest).padStart(2, '0')}` : `${hours}h`;
}

function formatHour(hour: number): string {
  const whole = Math.floor(hour);
  return `${String(whole).padStart(2, '0')}h${String(Math.round((hour - whole) * 60)).padStart(2, '0')}`;
}

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

  const [scenario, setScenario] = useState<Scenario>(PRESETS[0].scenario);
  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const update = (changes: Partial<Scenario>) => {
    // Mexer à mão deixa de ser "tensão forte com 95%": a confiança só vale
    // enquanto a emoção for a do cenário pronto.
    setScenario((current) => ({
      ...current,
      ...changes,
      emotionConfidence: 'emotion' in changes ? undefined : current.emotionConfidence,
    }));
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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {PRESETS.map((preset) => (
          <Chip
            key={preset.name}
            label={preset.name}
            selected={scenario === preset.scenario}
            onPress={() => {
              setScenario(preset.scenario);
              setResult(null);
            }}
          />
        ))}
      </ScrollView>

      <Card style={styles.form}>
        <Stepper
          label="Horário do dia"
          value={formatHour(scenario.hour)}
          onMinus={() => update({ hour: (scenario.hour + 23.5) % 24 })}
          onPlus={() => update({ hour: (scenario.hour + 0.5) % 24 })}
        />
        <Stepper
          label="Tempo de viagem"
          value={formatMinutes(scenario.tripMinutes)}
          onMinus={() => update({ tripMinutes: Math.max(0, scenario.tripMinutes - 15) })}
          onPlus={() => update({ tripMinutes: scenario.tripMinutes + 15 })}
        />
        <Stepper
          label="Distância percorrida"
          value={`${scenario.distanceKm} km`}
          onMinus={() => update({ distanceKm: Math.max(0, scenario.distanceKm - 25) })}
          onPlus={() => update({ distanceKm: scenario.distanceKm + 25 })}
        />
        <Stepper
          label="Tempo sem parada"
          value={formatMinutes(scenario.minutesSinceStop)}
          onMinus={() => update({ minutesSinceStop: Math.max(0, scenario.minutesSinceStop - 15) })}
          onPlus={() => update({ minutesSinceStop: scenario.minutesSinceStop + 15 })}
        />

        <Text variant="label" color="textSecondary">
          ESTADO EMOCIONAL
        </Text>
        <View style={styles.wrap}>
          {EMOTIONS.map((emotion) => (
            <Chip
              key={emotion}
              label={emotion === 'desconhecido' ? 'Sem leitura' : EMOTION_LABELS[emotion]}
              selected={scenario.emotion === emotion}
              onPress={() => update({ emotion })}
            />
          ))}
        </View>

        <Text variant="label" color="textSecondary">
          CLASSE DA IMAGEM
        </Text>
        <View style={styles.wrap}>
          {IMAGES.map((image) => (
            <Chip
              key={image}
              label={image === 'desconhecida' ? 'Sem foto' : IMAGE_CLASS_LABELS[image]}
              selected={scenario.image === image}
              onPress={() => update({ image })}
            />
          ))}
        </View>
      </Card>

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

function Stepper({
  label,
  value,
  onMinus,
  onPlus,
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <View style={styles.stepper}>
      <View style={styles.stepperText}>
        <Text variant="label" color="textSecondary">
          {label.toUpperCase()}
        </Text>
        <Text variant="metric">{value}</Text>
      </View>
      <StepButton icon="minus" label={`Diminuir ${label}`} onPress={onMinus} />
      <StepButton icon="plus" label={`Aumentar ${label}`} onPress={onPlus} />
    </View>
  );
}

function StepButton({
  icon,
  label,
  onPress,
}: {
  icon: 'minus' | 'plus';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}>
      <MaterialCommunityIcons name={icon} size={22} color={colors.primary} />
    </Pressable>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}>
      <Text variant="label" color={selected ? 'textOnPrimary' : 'primary'}>
        {label}
      </Text>
    </Pressable>
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
  chips: {
    gap: spacing.sm,
  },
  form: {
    gap: spacing.md,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepperText: {
    flex: 1,
  },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  chipSelected: {
    backgroundColor: colors.primary,
  },
  pressed: {
    opacity: 0.75,
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
