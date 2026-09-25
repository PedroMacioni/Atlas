import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { IconName } from '@/components/ui/icon-badge';
import { usePresentationState } from '@/features/presentation/state/presentation-state';
import { colors, dangerGradient, primaryGradient } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { shadows } from '@/theme/shadows';
import { spacing } from '@/theme/spacing';

export type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  /** Ícone à esquerda do rótulo. */
  icon?: IconName;
  /** Seta indicando avanço, à direita. */
  showChevron?: boolean;
  disabled?: boolean;
  /** Retorno tátil leve ao toque. */
  haptics?: boolean;
  /**
   * `danger` troca o azul pelo vermelho, para ação destrutiva. Mantém o mesmo
   * tamanho e sombra, para dois botões lado a lado ficarem iguais.
   */
  tone?: 'primary' | 'danger';
  /** Identificador para testes automatizados. */
  testID?: string;
};

/** Botão principal: pílula com gradiente azul, ícone e seta. */
export function PrimaryButton({
  label,
  onPress,
  icon,
  showChevron = true,
  disabled = false,
  haptics = true,
  tone = 'primary',
  testID,
}: PrimaryButtonProps) {
  const { pressedElement } = usePresentationState();
  const isPresentationPressed = testID !== undefined && pressedElement === testID;

  const handlePress = () => {
    if (haptics && Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
        // Aparelho sem motor háptico: seguir sem feedback é aceitável.
      });
    }
    onPress();
  };

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.pressable,
        shadows.raised,
        (pressed || isPresentationPressed) && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <LinearGradient
        colors={[...(tone === 'danger' ? dangerGradient : primaryGradient)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}>
        {icon ? (
          <MaterialCommunityIcons name={icon} size={20} color={colors.textOnPrimary} />
        ) : null}

        {/* Uma linha só: se um rótulo quebrasse, os botões lado a lado ficariam com alturas diferentes. */}
        <Text
          variant="action"
          color="textOnPrimary"
          numberOfLines={1}
          adjustsFontSizeToFit
          style={styles.label}>
          {label}
        </Text>

        {/* Espaço vazio do lado direito para equilibrar o ícone da esquerda e centralizar o texto. */}
        {showChevron ? (
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color={colors.textOnPrimary}
          />
        ) : icon ? (
          <View style={styles.sideSpacer} />
        ) : null}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: radius.pill,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.95 }],
  },
  disabled: {
    opacity: 0.45,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
  },
  label: {
    flexShrink: 1,
  },
  /** Mesma largura do ícone, para o rótulo ficar no centro. */
  sideSpacer: {
    width: 20,
  },
});
