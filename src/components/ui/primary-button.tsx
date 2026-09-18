import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { IconName } from '@/components/ui/icon-badge';
import { colors, dangerGradient, primaryGradient } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { shadows } from '@/theme/shadows';
import { spacing } from '@/theme/spacing';

export type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  /** Ícone à esquerda do rótulo. */
  icon?: IconName;
  /** Seta indicando avanço, à direita. */
  showChevron?: boolean;
  disabled?: boolean;
  /** Retorno tátil leve ao toque. */
  haptics?: boolean;
  /**
   * `danger` troca o gradiente azul pelo vermelho, para ação destrutiva.
   *
   * Continua sendo o botão primário: quando "Parar" e "Continuar" dividem uma
   * linha, os dois precisam ter o mesmo peso — mesma altura, mesmo raio, mesma
   * sombra. Um chapado claro ao lado de um com gradiente não se lê como par.
   */
  tone?: 'primary' | 'danger';
};

/**
 * Ação principal: pílula com gradiente azul, ícone e seta.
 *
 * É um controle desenhado, não o botão do sistema — o gradiente e a sombra do
 * design de referência não são expressáveis com `Button` nativo.
 */
export function PrimaryButton({
  label,
  onPress,
  icon,
  showChevron = true,
  disabled = false,
  haptics = true,
  tone = 'primary',
}: PrimaryButtonProps) {
  const handlePress = () => {
    if (haptics && Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
        // Aparelho sem motor háptico: seguir sem feedback é aceitável.
      });
    }
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.pressable,
        shadows.raised,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <LinearGradient
        colors={[...(tone === 'danger' ? dangerGradient : primaryGradient)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}>
        {icon ? (
          <MaterialCommunityIcons name={icon} size={20} color={colors.textOnPrimary} />
        ) : null}

        {/*
          Uma linha só: dois botões lado a lado com rótulos de larguras
          diferentes ficariam com alturas diferentes se um deles quebrasse — e
          um par de botões de alturas diferentes é a definição de torto.
        */}
        <Text
          variant="action"
          color="textOnPrimary"
          numberOfLines={1}
          adjustsFontSizeToFit
          style={styles.label}>
          {label}
        </Text>

        {/*
          O espaçador existe para **equilibrar** o elemento do outro lado, e
          não por hábito: com um ícone à esquerda e nada à direita, o rótulo
          nasceria fora do centro. Sem ícone e sem seta não há nada a
          equilibrar, e reservar 22 px aí era justamente o que deixava o
          rótulo torto.
        */}
        {showChevron ? (
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color={colors.textOnPrimary}
          />
        ) : icon ? (
          <View style={styles.sideSpacer} />
        ) : null}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: radius.pill,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.45,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
  },
  label: {
    flexShrink: 1,
  },
  /** Mesma largura do ícone, para o rótulo ficar no centro. */
  sideSpacer: {
    width: 20,
  },
});
