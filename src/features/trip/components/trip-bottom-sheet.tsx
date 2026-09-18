import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import { PrimaryButton } from '@/components/ui/primary-button';
import { SecondaryButton } from '@/components/ui/secondary-button';
import { Text } from '@/components/ui/text';
import { useDraggableSheet } from '@/features/trip/hooks/use-draggable-sheet';
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
  /** Encerra a viagem e sai da tela. */
  onEndTrip: () => void;
};

/**
 * Painel inferior da viagem, arrastável.
 *
 * Dois estados, e a divisão entre eles é sobre atenção:
 *
 * - **Fechado** é o estado de quem está dirigindo. Três números, grandes e sem
 *   rótulo: o horário de chegada, o tempo e a distância que faltam. Um relógio
 *   não precisa ser apresentado como relógio, e cada palavra a menos é espaço
 *   que volta para o mapa. Nenhum botão — nada aqui pede decisão.
 * - **Aberto** é o estado de quem parou para decidir. Revela **Parar** e
 *   **Continuar**, dois alvos grandes, longe de toque acidental.
 *
 * O horário vem primeiro e maior porque é a pergunta que de fato se faz numa
 * viagem: *a que horas eu chego?*. Tempo e distância respondem a mesma coisa de
 * forma indireta — quem quer saber "dá tempo?" lê o relógio, não faz a conta.
 *
 * O componente é apresentação: a mecânica do arraste vive em
 * `use-draggable-sheet`.
 */
export function TripBottomSheet({
  remainingSeconds,
  remainingMeters,
  bottomInset,
  onEndTrip,
}: TripBottomSheetProps) {
  const sheet = useDraggableSheet();

  return (
    <Animated.View style={[styles.sheet, shadows.raised, sheet.sheetStyle]}>
      {/*
        O gesto cobre só a alça e os números, e não o painel inteiro: com os
        botões dentro do detector, um toque em "Parar" competiria com o toque
        que fecha o painel — e a ação errada venceria de vez em quando.
      */}
      <GestureDetector gesture={sheet.gesture}>
        {/*
          O respiro do aparelho vive aqui, e não no painel: com o painel
          fechado é esta a última coisa visível, e os números não podem
          encostar na borda inferior nem ficar sobre o indicador de gesto.
        */}
        <View style={[styles.grabArea, { paddingBottom: bottomInset + spacing.sm }]}>
          <View style={styles.handle} />

          <Text variant="display" align="center" numberOfLines={1} adjustsFontSizeToFit>
            {formatArrivalTime(remainingSeconds)}
          </Text>

          <View style={styles.metrics}>
            <Text variant="metric" numberOfLines={1} align="right" style={styles.metric}>
              {formatShortDuration(remainingSeconds)}
            </Text>

            <View style={styles.dot} />

            <Text variant="metric" numberOfLines={1} align="left" style={styles.metric}>
              {formatDistance(remainingMeters)}
            </Text>
          </View>
        </View>
      </GestureDetector>

      {/*
        As ações existem no layout desde o início — é a altura delas que diz
        quanto o painel precisa descer. Ficam fora da tela enquanto ele está
        fechado, e não escondidas por opacidade: um botão invisível mas tocável
        é uma armadilha.

        O respiro inferior é medido junto, de propósito: é o que garante que
        descer a altura deste bloco esconda os botões por completo.
      */}
      <View
        style={[styles.actions, { paddingBottom: bottomInset + spacing.lg }]}
        onLayout={(event) => sheet.onHiddenAreaLayout(event.nativeEvent.layout.height)}>
        <View style={styles.action}>
          <SecondaryButton label="Parar" tone="danger" onPress={onEndTrip} />
        </View>
        <View style={styles.action}>
          <PrimaryButton label="Continuar" showChevron={false} onPress={sheet.close} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  /** Área que responde ao arrasto: alça e números. */
  grabArea: {
    gap: spacing.xs,
  },
  /** Traço que anuncia que o painel se move. */
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    marginBottom: spacing.xs,
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
  metric: {
    flex: 1,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  action: {
    flex: 1,
  },
});
