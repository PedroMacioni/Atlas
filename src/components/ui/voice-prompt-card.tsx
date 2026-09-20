import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { IconBadge } from '@/components/ui/icon-badge';
import { Text } from '@/components/ui/text';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';

export type VoicePromptCardProps = {
  title: string;
  subtitle: string;
  /**
   * Ação do toque. Sem ela o card fica atenuado e marcado "Em breve" — é o
   * que acontece no Expo Go, onde não há reconhecimento de fala: um microfone
   * que não ouve é pior que um microfone ausente.
   */
  onPress?: () => void;
  /** `true` enquanto ouve — o microfone fica vermelho. */
  listening?: boolean;
  /**
   * Liga e desliga a escuta contínua da palavra "Atlas" (CA-02). Sem ela o
   * interruptor não aparece: no Expo Go não há reconhecimento de fala.
   */
  onToggleWatch?: () => void;
  /** `true` quando a escuta contínua está ligada. */
  watching?: boolean;
};

/** Chamada para o comando de voz do Atlas. */
export function VoicePromptCard({
  title,
  subtitle,
  onPress,
  listening = false,
  onToggleWatch,
  watching = false,
}: VoicePromptCardProps) {
  const inert = !onPress;

  return (
    <Pressable
      accessibilityRole={inert ? undefined : 'button'}
      accessibilityLabel={inert ? undefined : title}
      disabled={inert}
      onPress={onPress}>
      {({ pressed }) => (
        <Card tone="muted" style={[styles.card, inert && styles.inert, pressed && styles.pressed]}>
          <View style={styles.badgeRow}>
            <View style={[styles.halo, listening && styles.haloListening]}>
              <IconBadge name="microphone" size="md" color={listening ? 'danger' : 'primary'} />
            </View>
            {inert ? (
              <View style={styles.soonTag}>
                <Text variant="label" color="textSecondary">
                  Em breve
                </Text>
              </View>
            ) : onToggleWatch ? (
              /*
                O interruptor da escuta contínua fica no card, e não numa
                tela de ajustes: é aqui que se decide se o Atlas fica ouvindo,
                e a decisão é de quem está no carro.
              */
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: watching }}
                accessibilityLabel={
                  watching ? 'Parar de ouvir sempre' : 'Deixar o Atlas sempre atento'
                }
                hitSlop={spacing.sm}
                onPress={onToggleWatch}
                style={[styles.watchTag, watching && styles.watchTagOn]}>
                <Text variant="label" color={watching ? 'primary' : 'textSecondary'}>
                  {watching ? 'Sempre atento' : 'Ficar atento'}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <Text variant="body" align="center" numberOfLines={2}>
            {title}
          </Text>
          <Text variant="label" color="textSecondary" align="center">
            {subtitle}
          </Text>
        </Card>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  watchTag: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  watchTagOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  card: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  inert: {
    opacity: 0.72,
  },
  pressed: {
    opacity: 0.8,
  },
  badgeRow: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  /** Anel claro em volta do microfone, como no design. */
  halo: {
    padding: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  haloListening: {
    backgroundColor: colors.dangerSoft,
  },
  soonTag: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
});
