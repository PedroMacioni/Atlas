import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';
import { fontFamily, textVariants } from '@/theme/typography';

export type SearchFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  /** Ação do microfone. Omitir esconde o botão. */
  onVoicePress?: () => void;
  /** Atenua o microfone, para quando a captura de voz ainda não existe. */
  voiceDisabled?: boolean;
  autoFocus?: boolean;
};

/**
 * Campo de busca com lupa à esquerda e microfone à direita.
 *
 * O botão de limpar aparece sozinho quando há texto, ocupando o lugar do
 * microfone — dois botões no mesmo canto competiriam pelo toque.
 */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  onVoicePress,
  voiceDisabled = false,
  autoFocus = false,
}: SearchFieldProps) {
  const hasText = value.length > 0;

  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name="magnify" size={22} color={colors.textSecondary} />

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        autoFocus={autoFocus}
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="never"
        style={styles.input}
      />

      {hasText ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Limpar busca"
          onPress={() => onChangeText('')}
          hitSlop={spacing.sm}
          style={({ pressed }) => pressed && styles.pressed}>
          <MaterialCommunityIcons name="close-circle" size={20} color={colors.textSecondary} />
        </Pressable>
      ) : onVoicePress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Buscar por voz"
          accessibilityState={{ disabled: voiceDisabled }}
          onPress={onVoicePress}
          hitSlop={spacing.sm}
          style={({ pressed }) => [
            styles.voice,
            voiceDisabled && styles.voiceDisabled,
            pressed && styles.pressed,
          ]}>
          <MaterialCommunityIcons name="microphone" size={20} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    minHeight: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  input: {
    flex: 1,
    /**
     * A fonte vem da escala tipográfica; `TextInput` não passa pelo
     * componente `Text`, então a variante é aplicada aqui na mão.
     */
    ...textVariants.body,
    fontFamily: fontFamily.medium,
    color: colors.text,
    /** Zera o padding implícito do Android para o texto centralizar. */
    paddingVertical: 0,
  },
  voice: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceDisabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.6,
  },
});
