import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, View } from 'react-native';

import { colors, type ColorToken } from '@/theme/colors';
import { radius } from '@/theme/radius';

/** Nomes válidos de ícone, restritos ao conjunto Material Community. */
export type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

export type IconBadgeProps = {
  name: IconName;
  /** Cor do glifo. O fundo é derivado dela. */
  color?: ColorToken;
  size?: 'sm' | 'md' | 'lg';
  /** Sem o círculo de fundo. */
  bare?: boolean;
};

const DIMENSIONS = {
  sm: { box: 34, glyph: 17 },
  md: { box: 44, glyph: 22 },
  lg: { box: 60, glyph: 28 },
} as const;

/**
 * Ícone dentro de um círculo colorido, o elemento mais repetido do design.
 * Usa `@expo/vector-icons` para ter os mesmos ícones no iOS e no Android.
 */
export function IconBadge({ name, color = 'primary', size = 'md', bare = false }: IconBadgeProps) {
  const { box, glyph } = DIMENSIONS[size];

  return (
    <View
      style={[
        styles.container,
        { width: box, height: box, borderRadius: radius.pill },
        !bare && { backgroundColor: colors.primarySoft },
      ]}>
      <MaterialCommunityIcons name={name} size={glyph} color={colors[color]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
