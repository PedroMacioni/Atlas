import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import type { SimulationOverrides } from '@/features/recommendation/types/recommendation';
import {
  EMOTION_LABELS,
  IMAGE_CLASS_LABELS,
} from '@/features/trip-session/constants/journal-labels';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';

/**
 * Formulário com as 6 variáveis do Random Forest, editáveis à mão. Usado no
 * simulador e na viagem de demonstração.
 */

export type Scenario = Required<Omit<SimulationOverrides, 'emotionConfidence'>> & {
  emotionConfidence?: number;
};

/** Cenários prontos. O primeiro é o do escopo (§19, Cenário 3). */
export const SCENARIO_PRESETS: { name: string; scenario: Scenario }[] = [
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

export function formatScenarioMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h${String(rest).padStart(2, '0')}` : `${hours}h`;
}

export function formatScenarioHour(hour: number): string {
  const whole = Math.floor(hour);
  return `${String(whole).padStart(2, '0')}h${String(Math.round((hour - whole) * 60)).padStart(2, '0')}`;
}

export type ScenarioFormProps = {
  scenario: Scenario;
  onChange: (scenario: Scenario) => void;
  /** Esconde a fileira de cenários prontos quando não houver espaço. */
  showPresets?: boolean;
};

export function ScenarioForm({ scenario, onChange, showPresets = true }: ScenarioFormProps) {
  const update = (changes: Partial<Scenario>) => {
    // Ao mexer na emoção, a confiança do cenário pronto deixa de valer.
    onChange({
      ...scenario,
      ...changes,
      emotionConfidence: 'emotion' in changes ? undefined : scenario.emotionConfidence,
    });
  };

  return (
    <>
      {showPresets ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presets}>
          {SCENARIO_PRESETS.map((preset) => (
            <Chip
              key={preset.name}
              label={preset.name}
              selected={scenario === preset.scenario}
              onPress={() => onChange(preset.scenario)}
            />
          ))}
        </ScrollView>
      ) : null}

      <Card style={styles.form}>
        <Stepper
          label="Horário do dia"
          value={formatScenarioHour(scenario.hour)}
          onMinus={() => update({ hour: (scenario.hour + 23.5) % 24 })}
          onPlus={() => update({ hour: (scenario.hour + 0.5) % 24 })}
        />
        <Stepper
          label="Tempo de viagem"
          value={formatScenarioMinutes(scenario.tripMinutes)}
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
          value={formatScenarioMinutes(scenario.minutesSinceStop)}
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
    </>
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

export function Chip({
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
  presets: {
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
});
