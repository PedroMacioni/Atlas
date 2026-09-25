import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeInLeft,
  FadeOutLeft,
  Easing,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import type { VoiceState } from '@/features/voice/hooks/use-voice';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { shadows } from '@/theme/shadows';
import { spacing } from '@/theme/spacing';

type VoiceMapControlProps = {
  state: VoiceState;
  partial: string;
  watching: boolean;
  onPress: () => void;
  onLongPress?: () => void;
};

/**
 * Botão de voz sobre o mapa. Ao ouvir, abre para a esquerda e mostra a fala
 * reconhecida; depois volta a ser só o ícone.
 */
export function VoiceMapControl({
  state,
  partial,
  watching,
  onPress,
  onLongPress,
}: VoiceMapControlProps) {
  const listening = state === 'listening';
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = listening ? withRepeat(withTiming(1, { duration: 900 }), -1, true) : 0;
  }, [listening, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.34 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.5 }],
  }));

  const status = partial || 'Ouvindo…';

  return (
    <Animated.View
      layout={LinearTransition.duration(360).easing(Easing.out(Easing.cubic))}
      style={[styles.container, listening ? styles.expanded : styles.collapsed]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={listening ? 'Parar comando de voz' : 'Iniciar comando de voz'}
        accessibilityHint="Mantenha pressionado para ativar ou desativar a escuta contínua"
        onPress={onPress}
        onLongPress={onLongPress}
        style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}>
        <View style={[styles.iconSlot, listening && styles.iconSlotListening]}>
          {listening ? <Animated.View style={[styles.pulse, pulseStyle]} /> : null}
          <MaterialCommunityIcons
            name="microphone"
            size={28}
            color={listening ? colors.danger : colors.primary}
          />
        </View>

        {listening ? (
          <Animated.View
            entering={FadeInLeft.duration(180).delay(80)}
            exiting={FadeOutLeft.duration(100)}
            style={styles.copy}>
            <Text variant="label" color="danger">
              OUVINDO AGORA
            </Text>
            <Text variant="body" numberOfLines={1}>
              {status}
            </Text>
          </Animated.View>
        ) : watching ? (
          <View style={styles.watchingDot} />
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...shadows.raised,
  },
  collapsed: {
    width: 56,
  },
  expanded: {
    width: 252,
  },
  pressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: radius.pill,
  },
  pressed: {
    opacity: 0.78,
  },
  iconSlot: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  iconSlotListening: {
    backgroundColor: colors.dangerSoft,
  },
  pulse: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
    paddingRight: spacing.lg,
  },
  watchingDot: {
    position: 'absolute',
    top: 6,
    right: 5,
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.success,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
});
