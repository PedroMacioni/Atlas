import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';

export type SectionHeaderProps = {
  title: string;
  /** Texto discreto à direita, como uma contagem ou "Em breve". */
  hint?: string;
};

/** Título de seção com uma nota opcional à direita. */
export function SectionHeader({ title, hint }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Text variant="heading">{title}</Text>
      {hint ? (
        <Text variant="label" color="textSecondary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
