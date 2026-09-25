import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { shadows } from '@/theme/shadows';
import { spacing } from '@/theme/spacing';

export function WakeStatusCard({ consulting = false }: { consulting?: boolean }) {
  return (
    <Animated.View
      nativeID="wake-status-card"
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(160)}
      accessibilityRole="text"
      accessibilityLabel={consulting ? 'Consultando Atlas. Analisando a viagem.' : 'Atlas na escuta. Diga Atlas para começar.'}
      style={[styles.card, shadows.raised]}>
      <View style={styles.icon}>
        {consulting ? <ActivityIndicator size="small" color={colors.primary} /> : <MaterialCommunityIcons name="microphone-outline" size={20} color={colors.primary} />}
      </View>
      <View style={styles.copy}>
        <Text variant="label" color="text" numberOfLines={1}>{consulting ? 'Consultando Atlas' : 'Atlas na escuta'}</Text>
        <Text variant="label" color="textSecondary" numberOfLines={1}>{consulting ? 'Analisando viagem' : 'Diga “Atlas”'}</Text>
      </View>
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
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flexShrink: 1,
  },
});
