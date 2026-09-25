import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { shadows } from '@/theme/shadows';
import { spacing } from '@/theme/spacing';
import { formatSpeed, toKilometersPerHour } from '@/utils/speed';

export type SpeedBadgeProps = {
  /** Velocidade crua do GPS, em metros por segundo. */
  metersPerSecond: number | null;
};

/**
 * Velocímetro da viagem, no canto superior esquerdo do mapa.
 *
 * Mostra sempre um número: quando não há leitura (antes do GPS responder, ou
 * quando o iOS devolve `-1` por não saber), mostra 0, como o velocímetro de um
 * carro. Um velocímetro que some ou mostra traços parece defeito.
 *
 * A conversão em `utils/speed.ts` continua devolvendo `null`; a escolha de
 * mostrar 0 é só da tela.
 */
export function SpeedBadge({ metersPerSecond }: SpeedBadgeProps) {
  const speed = formatSpeed(toKilometersPerHour(metersPerSecond) ?? 0);

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Velocidade atual: ${speed} quilômetros por hora`}
      style={[styles.badge, shadows.raised]}>
      <Text variant="metric" numberOfLines={1} adjustsFontSizeToFit>
        {speed}
      </Text>
      <Text variant="label" color="textSecondary" numberOfLines={1}>
        km/h
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    /** Círculo com largura fixa, para o tamanho não mudar entre 9 e 120 km/h. */
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
});
