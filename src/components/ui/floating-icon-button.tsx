import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet } from 'react-native';

import type { IconName } from '@/components/ui/icon-badge';
import { colors, type ColorToken } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { shadows } from '@/theme/shadows';

export type FloatingIconButtonProps = {
  icon: IconName;
  onPress: () => void;
  /**
   * O que a ação faz, para leitores de tela.
   *
   * Obrigatório, e não opcional: um botão sem rótulo visível é invisível para
   * quem não vê o ícone. É a única descrição que o controle tem.
   */
  accessibilityLabel: string;
  iconColor?: ColorToken;
  /**
   * `md` é o alvo mínimo de toque das duas plataformas (44 pt). `lg` é para o
   * controle principal sobre o mapa, que precisa ser acertado de relance com
   * o carro em movimento.
   */
  size?: 'md' | 'lg';
  /** Ação secundária, por toque longo — descrita em `accessibilityHint`. */
  onLongPress?: () => void;
  accessibilityHint?: string;
};

const SIZES = {
  md: { box: 44, icon: 22 },
  lg: { box: 56, icon: 28 },
} as const;

/**
 * Botão circular que flutua sobre o mapa.
 *
 * Sem rótulo de texto — é o padrão dos aplicativos de navegação, onde cada
 * palavra na tela disputa espaço com o trajeto. O tamanho não é arbitrário:
 * 44 pt é o alvo mínimo de toque recomendado pelas duas plataformas, e o
 * controle principal de uma tela usada dirigindo merece mais que o mínimo.
 */
export function FloatingIconButton({
  icon,
  onPress,
  accessibilityLabel,
  iconColor = 'primary',
  size = 'md',
  onLongPress,
  accessibilityHint,
}: FloatingIconButtonProps) {
  const { box, icon: iconSize } = SIZES[size];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.button,
        { width: box, height: box },
        shadows.raised,
        pressed && styles.pressed,
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
