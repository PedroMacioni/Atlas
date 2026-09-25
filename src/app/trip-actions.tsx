import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IconName } from '@/components/ui/icon-badge';
import { Text } from '@/components/ui/text';
import { usePresentationState } from '@/features/presentation/state/presentation-state';
import { requestTripAction, type TripActionRequest } from '@/features/trip/state/trip-action-request';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';

type ActionItem = {
  action: TripActionRequest;
  icon: IconName;
  title: string;
  subtitle: string;
  danger?: boolean;
  /** Id usado pelo efeito de "pressionado" do modo apresentação. */
  testID?: string;
};

export default function TripActionsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { watching } = useLocalSearchParams<{ watching?: string }>();
  const { pressedElement } = usePresentationState();

  const actions: ActionItem[] = [
    {
      action: 'toggle-wake',
      icon: watching === '1' ? 'ear-hearing' : 'ear-hearing-off',
      title: watching === '1' ? 'Desativar escuta contínua' : 'Ativar escuta contínua',
      subtitle: 'Use "Atlas" para chamar a assistência por voz.',
      testID: 'toggle-wake-option',
    },
    {
      action: 'ask-recommendation',
      icon: 'lightbulb-on-outline',
      title: 'Pedir sugestão ao Atlas',
      subtitle: 'Encontre uma parada para descansar ou abastecer.',
    },
    {
      action: 'register-stop',
      icon: 'map-marker-plus',
      title: 'Registrar parada',
      subtitle: 'Guarde este momento no diário da viagem.',
    },
    {
      action: 'end-trip',
      icon: 'stop-circle-outline',
      title: 'Encerrar viagem',
      subtitle: 'Salve o trajeto e veja o resumo.',
      danger: true,
    },
  ];

  const choose = (action: TripActionRequest) => {
    requestTripAction(action);
    router.back();
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Text variant="heading" style={styles.title}>
          Ações da viagem
        </Text>

        {actions.map((item) => {
          const isPresentationPressed = item.testID !== undefined && pressedElement === item.testID;
          return (
          <Pressable
            key={item.action}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            accessibilityHint={item.subtitle}
            testID={item.testID}
            onPress={() => choose(item.action)}
            style={({ pressed }) => [
              styles.option,
              item.danger && styles.optionDanger,
              (pressed || isPresentationPressed) && styles.pressed,
            ]}>
            <View style={[styles.icon, item.danger && styles.iconDanger]}>
              <MaterialCommunityIcons
                name={item.icon}
                size={28}
                color={item.danger ? colors.danger : colors.primary}
              />
            </View>
            <View style={styles.texts}>
              <Text variant="heading" color={item.danger ? 'danger' : 'text'}>
                {item.title}
              </Text>
              <Text variant="bodySoft" color="textSecondary">
                {item.subtitle}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textSecondary} />
          </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  title: {
    textAlign: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionDanger: {
    borderColor: colors.dangerSoft,
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDanger: {
    backgroundColor: colors.dangerSoft,
  },
  texts: {
    flex: 1,
    gap: 2,
  },
  pressed: {
    opacity: 0.75,
  },
});
