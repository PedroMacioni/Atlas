import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';

export type ProgressBarProps = {
  /** Fração concluída, de 0 a 1. Valores fora da faixa são aparados. */
  value: number;
  /** Descrição do que a barra representa, para leitores de tela. */
  accessibilityLabel: string;
};

/**
 * Barra de progresso do trajeto.
 *
 * Um traço, e só. O valor numérico já está escrito ao lado dela em toda tela
 * que a usa, então a barra não repete texto — ela existe para dar a leitura
 * imediata de "quanto falta" sem exigir leitura de número.
 *
 * O papel de acessibilidade é `progressbar` com os limites declarados, o que
 * faz o VoiceOver e o TalkBack anunciarem a porcentagem sozinhos.
 */
export function ProgressBar({ value, accessibilityLabel }: ProgressBarProps) {
  const clamped = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={styles.track}>
      <View style={[styles.fill, { width: `${clamped * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
});
