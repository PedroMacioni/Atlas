import { Text as RNText, StyleSheet, type TextProps as RNTextProps } from 'react-native';

import { colors, type ColorToken } from '@/theme/colors';
import { textVariants, type TextVariant } from '@/theme/typography';

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  /** Token de cor. O padrão é o texto principal. */
  color?: ColorToken;
  align?: 'left' | 'center' | 'right';
};

/**
 * Componente de texto do app. Aplica fonte, tamanho e espaçamento da escala de
 * `theme/typography.ts`, para nenhuma tela precisar definir isso na mão.
 */
export function Text({
  variant = 'body',
  color = 'text',
  align,
  style,
  ...rest
}: TextProps) {
  return (
    <RNText
      {...rest}
      style={StyleSheet.compose(
        [textVariants[variant], { color: colors[color] }, align ? { textAlign: align } : null],
        style,
      )}
    />
  );
}
