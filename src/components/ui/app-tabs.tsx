import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { colors } from '@/theme/colors';

/**
 * Barra de abas do sistema.
 *
 * `NativeTabs` renderiza a `UITabBar` real no iOS (com o visual Liquid Glass
 * no iOS 26+) e a `BottomNavigationView` Material 3 no Android — não é uma
 * barra desenhada em JavaScript. Os ícones vêm dos catálogos nativos:
 * SF Symbols no iOS (`sf`) e Material Symbols no Android (`md`), sem
 * depender de nenhuma biblioteca de ícones.
 */
export function AppTabs() {
  return (
    <NativeTabs backgroundColor={colors.surface} iconColor={colors.textSecondary}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Início</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" selectedColor={colors.primary} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="about">
        <NativeTabs.Trigger.Label>Sobre</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="info.circle.fill" md="info" selectedColor={colors.primary} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
