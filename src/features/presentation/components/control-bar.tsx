import { BlurView } from 'expo-blur';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ActIndicator } from './act-indicator';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';

export type ControlBarProps = {
  currentAct: number;
  totalActs: number;
  isPaused: boolean;
  onPrev: () => void;
  onNext: () => void;
  onTogglePause: () => void;
};

export function ControlBar({
  currentAct,
  totalActs,
  isPaused,
  onPrev,
  onNext,
  onTogglePause,
}: ControlBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <BlurView
      intensity={100}
      tint="dark"
      style={[styles.container, { paddingBottom: insets.bottom + spacing.sm }]}
    >
      <View style={styles.content}>
        <ControlButton icon="chevron-left" onPress={onPrev} disabled={currentAct <= 1} />

        <ActIndicator currentAct={currentAct} totalActs={totalActs} />

        <ControlButton icon="chevron-right" onPress={onNext} disabled={currentAct >= totalActs} />

        <View style={styles.divider} />

        <ControlButton icon={isPaused ? 'play' : 'pause'} onPress={onTogglePause} />
      </View>
    </BlurView>
  );
}

type ControlButtonProps = {
  icon: 'chevron-left' | 'chevron-right' | 'play' | 'pause';
  onPress: () => void;
  disabled?: boolean;
};

function ControlButton({ icon, onPress, disabled }: ControlButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={24}
        color={disabled ? colors.textSecondary : colors.textOnPrimary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  buttonPressed: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    transform: [{ scale: 0.95 }],
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
});
