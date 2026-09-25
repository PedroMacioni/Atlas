import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { usePresentationState } from '@/features/presentation/state/presentation-state';
import type { Voice } from '@/features/voice/hooks/use-voice';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { shadows } from '@/theme/shadows';
import { spacing } from '@/theme/spacing';

/**
 * Faixa que mostra que o Atlas está ouvindo e o que ele está entendendo. Ver o
 * texto aparecendo dá confiança de que o comando vai funcionar.
 */
export function VoiceIndicator({ voice }: { voice: Pick<Voice, 'state' | 'partial' | 'error'> }) {
  const { demoVoiceText } = usePresentationState();

  // Modo apresentação: mostra o texto de voz simulado.
  if (demoVoiceText) {
    return (
      <View style={[styles.bar, shadows.raised]}>
        <MaterialCommunityIcons name="microphone" size={22} color={colors.danger} />
        <Text variant="body" numberOfLines={2} style={styles.text}>
          {demoVoiceText}
        </Text>
      </View>
    );
  }

  if (voice.state === 'listening') {
    return (
      <View style={[styles.bar, shadows.raised]}>
        <MaterialCommunityIcons name="microphone" size={22} color={colors.danger} />
        <Text variant="body" numberOfLines={2} style={styles.text}>
          {voice.partial || 'Ouvindo…'}
        </Text>
      </View>
    );
  }

  if (voice.error) {
    return (
      <View style={[styles.bar, styles.error]}>
        <MaterialCommunityIcons name="microphone-off" size={22} color={colors.danger} />
        <Text variant="bodySoft" color="danger" numberOfLines={3} style={styles.text}>
          {voice.error}
        </Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  error: {
    backgroundColor: colors.dangerSoft,
  },
  text: {
    flex: 1,
  },
});
