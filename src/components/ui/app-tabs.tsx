import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { colors } from '@/theme/colors';

/**
 * Barra de abas nativa do sistema (iOS e Android), com ícones nativos:
 * SF Symbols no iOS e Material Symbols no Android.
 */
export function AppTabs() {
  return (
    <NativeTabs backgroundColor={colors.surface} iconColor={colors.textSecondary}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Início</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" selectedColor={colors.primary} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Label>Histórico</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="clock.fill" md="history" selectedColor={colors.primary} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="about">
        <NativeTabs.Trigger.Label>Sobre</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="info.circle.fill" md="info" selectedColor={colors.primary} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
