import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { spacing } from '@/theme/spacing';

export type SectionHeaderProps = {
  title: string;
  /** Texto discreto à direita, como uma contagem ou "Em breve". */
  hint?: string;
  /** Controle à direita, como um filtro. Aparece depois da nota. */
  accessory?: ReactNode;
};

/** Título de seção com uma nota opcional à direita. */
export function SectionHeader({ title, hint, accessory }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Text variant="heading" style={styles.title}>
        {title}
      </Text>
      {hint ? (
        <Text variant="label" color="textSecondary">
          {hint}
        </Text>
      ) : null}
      {accessory}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    flex: 1,
  },
});
