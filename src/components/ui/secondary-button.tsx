import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/ui/text';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';

export type SecondaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** `danger` sinaliza recuperação de erro em vez de ação neutra. */
  tone?: 'neutral' | 'danger';
};

/** Ação de apoio: pílula azul clara, sem gradiente e sem elevação. */
export function SecondaryButton({
  label,
  onPress,
  disabled = false,
  tone = 'neutral',
}: SecondaryButtonProps) {
  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {
        // Sem motor háptico: segue sem feedback.
      });
    }
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.container,
        tone === 'danger' ? styles.danger : styles.neutral,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <Text variant="action" color={tone === 'danger' ? 'danger' : 'primary'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
  },
  neutral: {
    backgroundColor: colors.primarySoft,
  },
  danger: {
    backgroundColor: colors.dangerSoft,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.45,
  },
});
