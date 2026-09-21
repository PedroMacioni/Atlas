import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useMemo, useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/primary-button';
import { Text } from '@/components/ui/text';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { shadows } from '@/theme/shadows';
import { spacing } from '@/theme/spacing';
import { formatArrivalTime, formatShortDuration } from '@/utils/arrival';
import { formatDistance } from '@/utils/distance';

export type TripBottomSheetProps = {
  remainingSeconds: number;
  remainingMeters: number;
  bottomInset: number;
  leading?: ReactNode;
  onEndTrip?: () => void;
};

/**
 * Painel arrastável com hora de chegada, duração e distância.
 *
 * Ao puxar para cima, revela o botão "Encerrar viagem".
 */
export function TripBottomSheet({
  remainingSeconds,
  remainingMeters,
  bottomInset,
  leading,
  onEndTrip,
}: TripBottomSheetProps) {
  const sheetRef = useRef<BottomSheet>(null);

  // Colapsado esconde o botão, expandido revela
  const snapPoints = useMemo(() => {
    const collapsed = 80 + bottomInset;
    const expanded = 170 + bottomInset;
    return [collapsed, expanded];
  }, [bottomInset]);

  return (
    <View style={styles.container} pointerEvents="box-none">
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={snapPoints}
        backgroundStyle={[styles.background, shadows.raised]}
        handleIndicatorStyle={styles.handle}
        enablePanDownToClose={false}
        enableDynamicSizing={false}>
        <BottomSheetView style={styles.content}>
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

          <View style={styles.buttonContainer}>
            <PrimaryButton
              label="Encerrar viagem"
              icon="stop-circle-outline"
              tone="danger"
              showChevron={false}
              onPress={onEndTrip ?? (() => {})}
            />
          </View>
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    top: 0,
  },
  leading: {
    position: 'absolute',
    bottom: 110,
    left: 0,
    right: 0,
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
  },
  background: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  metrics: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  metric: {
    flex: 1,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.textSecondary,
  },
  buttonContainer: {
    marginTop: spacing.md,
  },
});
