import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { SecondaryButton } from '@/components/ui/secondary-button';
import { Text } from '@/components/ui/text';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { shadows } from '@/theme/shadows';
import { spacing } from '@/theme/spacing';

export type StatusMessageTone = 'info' | 'error';

export type StatusMessageProps = {
  tone: StatusMessageTone;
  message: string;
  /** Mostra um indicador de atividade antes do texto. */
  busy?: boolean;
  /** Quando informado, exibe uma ação de recuperação. */
  onRetry?: () => void;
  retryLabel?: string;
  /** Aplica elevação, para quando a faixa flutua sobre o mapa. */
  floating?: boolean;
};

/** Faixa compacta de estado — carregando ou erro — sem esconder o conteúdo. */
export function StatusMessage({
  tone,
  message,
  busy = false,
  onRetry,
  retryLabel = 'Tentar novamente',
  floating = false,
}: StatusMessageProps) {
  const isError = tone === 'error';

  return (
    <View
      style={[
        styles.container,
        isError ? styles.error : styles.info,
        floating && shadows.raised,
      ]}>
      <View style={styles.row}>
        {busy ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        <Text
          variant="bodySoft"
          color={isError ? 'danger' : 'text'}
          numberOfLines={3}
          style={styles.message}>
          {message}
        </Text>
      </View>

      {onRetry ? <SecondaryButton label={retryLabel} onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  info: {
    backgroundColor: colors.surfaceMuted,
  },
  error: {
    backgroundColor: colors.dangerSoft,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  message: {
    flex: 1,
  },
});
