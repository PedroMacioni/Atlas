import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet } from 'react-native';

import type { IconName } from '@/components/ui/icon-badge';
import { usePresentationState } from '@/features/presentation/state/presentation-state';
import { colors, type ColorToken } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { shadows } from '@/theme/shadows';

export type FloatingIconButtonProps = {
  icon: IconName;
  onPress: () => void;
  /**
   * O que o botão faz, para leitores de tela. Obrigatório, porque o botão não
   * tem texto visível.
   */
  accessibilityLabel: string;
  iconColor?: ColorToken;
  /** `md` = 44 pt (tamanho mínimo de toque); `lg` = botão principal sobre o mapa. */
  size?: 'md' | 'lg';
  /** Ação secundária, por toque longo — descrita em `accessibilityHint`. */
  onLongPress?: () => void;
  accessibilityHint?: string;
  /** Identificador para o efeito de pressionado da apresentação. */
  testID?: string;
};

const SIZES = {
  md: { box: 44, icon: 22 },
  lg: { box: 56, icon: 28 },
} as const;

/**
 * Botão redondo que flutua sobre o mapa, só com ícone (padrão dos apps de
 * navegação, para não tampar o trajeto).
 */
export function FloatingIconButton({
  icon,
  onPress,
  accessibilityLabel,
  iconColor = 'primary',
  size = 'md',
  onLongPress,
  accessibilityHint,
  testID,
}: FloatingIconButtonProps) {
  const { box, icon: iconSize } = SIZES[size];
  const { pressedElement } = usePresentationState();
  const isPresentationPressed = testID !== undefined && pressedElement === testID;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      onLongPress={onLongPress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        { width: box, height: box },
        shadows.raised,
        (pressed || isPresentationPressed) && styles.pressed,
      ]}>
      <MaterialCommunityIcons name={icon} size={iconSize} color={colors[iconColor]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
});
