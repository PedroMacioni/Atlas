import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { shadows } from '@/theme/shadows';
import { spacing } from '@/theme/spacing';
import { formatArrivalTime, formatShortDuration } from '@/utils/arrival';
import { formatDistance } from '@/utils/distance';

export type TripBottomSheetProps = {
  /** Segundos até o destino. */
  remainingSeconds: number;
  /** Metros até o destino. */
  remainingMeters: number;
  /** Respiro inferior do aparelho, já resolvido pela tela. */
  bottomInset: number;
  onEndTrip: () => void;
};

/**
 * Painel inferior da viagem.
 *
 * A hierarquia é deliberada e tem uma pergunta no topo: **a que horas eu
 * chego?** É ela que o passageiro faz e que o motorista responde, e por isso o
 * horário vem centralizado e grande. Tempo e distância ficam abaixo, menores,
 * porque respondem a mesma coisa de forma indireta — quem quer saber "dá
 * tempo?" lê o relógio, não faz a conta.
 *
 * O ponto entre os dois números é separador, não decoração: mantém a linha
 * legível sem desenhar uma divisória que competiria com a sombra do painel.
 *
 * Só as bordas de cima são arredondadas — o painel nasce da borda inferior da
 * tela, e arredondar embaixo deixaria um vão contra o mapa.
 *
 * O controle de câmera não vive aqui: é um ícone que flutua sobre o mapa, como
 * nos aplicativos de navegação. Este painel é para ler, não para operar.
 */
export function TripBottomSheet({
  remainingSeconds,
  remainingMeters,
  bottomInset,
  onEndTrip,
}: TripBottomSheetProps) {
  return (
    <View style={[styles.sheet, shadows.raised, { paddingBottom: bottomInset + spacing.lg }]}>
      <View style={styles.arrival}>
        <Text variant="label" color="textSecondary">
          CHEGADA PREVISTA
        </Text>
        <Text variant="title" numberOfLines={1}>
          {formatArrivalTime(remainingSeconds)}
        </Text>
      </View>

      <View style={styles.metrics}>
        <Text variant="body" color="textSecondary" numberOfLines={1} style={styles.metricLeft}>
          {formatShortDuration(remainingSeconds)}
        </Text>

        <View style={styles.dot} />

        <Text variant="body" color="textSecondary" numberOfLines={1} style={styles.metricRight}>
          {formatDistance(remainingMeters)}
        </Text>
      </View>

      {/*
        Encerrar fica abaixo dos números, e não entre eles: a linha de métricas
        é para ser lida de relance, e um botão ali roubaria o lugar do que
        importa. O controle de câmera saiu daqui e virou ícone flutuante sobre
        o mapa, onde o padrão de navegação o coloca.
      */}
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Encerrar a viagem"
          onPress={onEndTrip}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}>
          <MaterialCommunityIcons name="close-circle-outline" size={18} color={colors.danger} />
          <Text variant="action" color="danger">
            Encerrar viagem
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  arrival: {
    alignItems: 'center',
    gap: 2,
  },
  metrics: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  /**
   * As duas métricas recebem a mesma largura e se alinham para lados opostos,
   * o que mantém o ponto exatamente no centro — independente de "7,9 km" ser
   * mais curto que "1h05".
   */
  metricLeft: {
    flex: 1,
    textAlign: 'right',
  },
  metricRight: {
    flex: 1,
    textAlign: 'left',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingTop: spacing.xs,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
  },
  actionPressed: {
    opacity: 0.6,
    backgroundColor: colors.surfaceMuted,
  },
});
