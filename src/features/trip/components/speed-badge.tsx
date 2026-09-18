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
 * Velocímetro da viagem.
 *
 * Círculo no canto inferior esquerdo, sobre o mapa — a posição que os
 * aplicativos de navegação usam, e que aqui não disputa espaço com nada: a
 * instrução está no topo, o painel embaixo, e este canto estava vazio.
 *
 * O número domina e a unidade fica miúda embaixo. É a leitura de um
 * velocímetro de verdade: o valor se lê de relance, e "km/h" só precisa estar
 * lá para dizer em que escala.
 *
 * O mostrador está **sempre na tela** e sempre marca um número — `0` quando
 * não há leitura. Um velocímetro que some, ou que mostra traços, parece
 * defeito.
 *
 * "Sem leitura" é mais comum do que parece: o iOS devolve `-1` para a
 * velocidade quando não consegue estimá-la — parado, sem sinal, ou nos
 * primeiros segundos de um trajeto — e antes da primeira leitura do GPS não
 * existe posição alguma. Nesses casos o mostrador marca zero, que é o que um
 * velocímetro de carro faz: ele não sabe distinguir "parado" de "não sei", e
 * quem está lendo também não precisa dessa distinção.
 *
 * A conversão, em `utils/speed.ts`, continua devolvendo `null` quando não sabe.
 * A escolha de exibir zero é de apresentação, e mora aqui.
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
    /**
     * Círculo, e não pílula: é a forma de velocímetro, e a que distingue este
     * número dos outros da tela num olhar. A largura fixa também impede que o
     * mostrador mude de tamanho entre 9 e 120 km/h.
     */
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
});
