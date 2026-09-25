import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { shadows } from '@/theme/shadows';
import { spacing } from '@/theme/spacing';

export function StopArrival() {
  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={[styles.card, shadows.raised]}>
        <View style={styles.iconArea}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="check" size={30} color={colors.textOnPrimary} />
          </View>
        </View>
        <Text variant="heading" align="center">Parada alcançada</Text>
        <Text variant="bodySoft" color="textSecondary" align="center">
          Hora de fazer uma pausa.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: '34%',
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
    zIndex: 70,
  },
  card: {
    minWidth: 220,
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  iconArea: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
