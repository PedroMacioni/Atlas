import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { describeManeuver, formatManeuverDistance } from '@/features/trip/utils/maneuver-text';
import type { NextManeuver } from '@/features/trip/utils/next-maneuver';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { shadows } from '@/theme/shadows';
import { spacing } from '@/theme/spacing';

export type ManeuverBannerProps = {
  maneuver: NextManeuver;
};

/**
 * Faixa de instrução no topo da viagem.
 *
 * A distância vem primeiro e grande (diz se a manobra é agora ou depois), a
 * instrução em seguida e o ícone à esquerda. O fundo escuro destaca a faixa
 * sobre o mapa.
 */
export function ManeuverBanner({ maneuver }: ManeuverBannerProps) {
  const { instruction, icon } = describeManeuver(maneuver.step);
  const distance = formatManeuverDistance(maneuver.distanceMeters);

  return (
    <View style={[styles.container, shadows.raised]}>
      <MaterialCommunityIcons name={icon} size={34} color={colors.textOnPrimary} />

      <View style={styles.texts}>
        {distance ? (
          <Text variant="metric" color="textOnPrimary" numberOfLines={1}>
            {distance}
          </Text>
        ) : null}

        <Text variant="body" color="textOnPrimary" numberOfLines={2}>
          {instruction}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.text,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  texts: {
    flex: 1,
    gap: 2,
  },
});
