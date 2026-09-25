import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { shadows } from '@/theme/shadows';
import { spacing } from '@/theme/spacing';

export type TripStatusCardProps = {
  icon: 'map-marker-path' | 'routes' | 'check-circle' | 'map-marker-check';
  title: string;
  subtitle?: string;
  busy?: boolean;
  onCancel?: () => void;
};

const ICON_COLOR: Record<TripStatusCardProps['icon'], string> = {
  'map-marker-path': colors.primary,
  'routes': colors.primary,
  'check-circle': colors.success,
  'map-marker-check': colors.success,
};

export function TripStatusCard({ icon, title, subtitle, busy, onCancel }: TripStatusCardProps) {
  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(160)}
      accessibilityRole="text"
      accessibilityLabel={`${title}. ${subtitle ?? ''}`}
      style={[styles.card, shadows.raised]}>
      <View style={[styles.icon, { backgroundColor: icon.includes('check') ? colors.successSoft : colors.primarySoft }]}>
        {busy ? (
          <ActivityIndicator size="small" color={ICON_COLOR[icon]} />
        ) : (
          <MaterialCommunityIcons name={icon} size={20} color={ICON_COLOR[icon]} />
        )}
      </View>
      <View style={styles.copy}>
        <Text variant="label" color="text" numberOfLines={1}>{title}</Text>
        {subtitle ? <Text variant="label" color="textSecondary" numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {onCancel ? (
        <MaterialCommunityIcons
          name="close"
          size={18}
          color={colors.textSecondary}
          onPress={onCancel}
          accessibilityLabel="Cancelar"
          accessibilityRole="button"
          style={styles.close}
        />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 64,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    flexShrink: 1,
  },
  close: {
    padding: spacing.xs,
  },
});
