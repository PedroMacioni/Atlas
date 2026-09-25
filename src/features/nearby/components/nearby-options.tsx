import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { StatusMessage } from '@/components/ui/status-message';
import { Text } from '@/components/ui/text';
import type { NearbyPlace, NearbyResponse } from '@/features/nearby/types/nearby';
import { usePresentationState } from '@/features/presentation/state/presentation-state';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';
import { formatShortDuration } from '@/utils/arrival';
import { formatDistance } from '@/utils/distance';

export type NearbyOptionsProps = {
  result: NearbyResponse | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelect: (place: NearbyPlace) => void;
  /** Rótulo da ação de cada linha, para leitores de tela. */
  actionLabel?: string;
};

/**
 * As opções próximas (RF-08) — 3, ou 10 na tela de destino: nome, distância,
 * tempo estimado e nota.
 *
 * Usada nas três portas que levam a um lugar: a categoria na tela de destino,
 * o hospital da emergência e o local de uma recomendação aceita.
 *
 * Quando a lista veio da reserva do OpenStreetMap, a tela diz isso — e diz
 * que não há nota, em vez de mostrar um espaço vazio que pareceria defeito.
 */
export function NearbyOptions({
  result,
  isLoading,
  error,
  onRetry,
  onSelect,
  actionLabel = 'Ir para',
}: NearbyOptionsProps) {
  const { pressedElement } = usePresentationState();

  if (error) {
    return <StatusMessage tone="error" message={error} onRetry={onRetry} />;
  }

  if (isLoading || !result) {
    return <StatusMessage tone="info" message="Buscando as opções mais próximas…" busy />;
  }

  if (result.places.length === 0) {
    return (
      <StatusMessage tone="info" message="Nenhuma opção encontrada por perto." onRetry={onRetry} />
    );
  }

  // Só o Google tem nota; das outras fontes, a tela diz de onde vieram.
  const sourceLabel = SOURCE_LABELS[result.source] ?? result.source;
  const withoutRating = result.source !== 'google-places';

  return (
    <View style={styles.list} testID="nearby-options">
      {result.places.map((place, index) => {
        const testID = `place-row-${index}`;
        const isPresentationPressed = pressedElement === testID;

        return (
          <Pressable
            key={place.id}
            testID={testID}
            accessibilityRole="button"
            accessibilityLabel={`${actionLabel} ${place.name}`}
            onPress={() => onSelect(place)}
            style={({ pressed }) => [
              styles.row,
              (pressed || isPresentationPressed) && styles.pressed,
            ]}>
          <View style={styles.rank}>
            <Text variant="body" color="primary">
              {index + 1}
            </Text>
          </View>

          <View style={styles.texts}>
            <Text variant="body" numberOfLines={1}>
              {place.name}
            </Text>
            {place.address ? (
              <Text variant="label" color="textSecondary" numberOfLines={1}>
                {place.address}
              </Text>
            ) : null}
            <View style={styles.facts}>
              <Text variant="label">
                {formatDistance(place.distanceMeters)}
                {place.byRoad ? '' : ' em linha reta'}
                {place.durationSeconds !== null
                  ? ` · ${formatShortDuration(place.durationSeconds)}`
                  : ''}
              </Text>
              <Rating value={place.rating} count={place.ratingCount} />
            </View>
          </View>

          <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textSecondary} />
        </Pressable>
        );
      })}

      {withoutRating && result.source !== 'presentation' ? (
        <Text variant="label" color="textSecondary">
          Fonte: {sourceLabel}, sem nota
          {result.fallbackReason ? ` (${result.fallbackReason})` : ''}.
        </Text>
      ) : null}
    </View>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  tomtom: 'TomTom',
  openstreetmap: 'OpenStreetMap',
};

function Rating({ value, count }: { value: number | null; count: number | null }) {
  if (value === null) {
    return (
      <Text variant="label" color="textSecondary">
        sem nota
      </Text>
    );
  }

  return (
    <View style={styles.rating}>
      <MaterialCommunityIcons name="star" size={14} color={colors.categoryFood} />
      <Text variant="label">
        {value.toFixed(1).replace('.', ',')}
        {count ? ` (${count})` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
    backgroundColor: colors.primarySoft,
  },
  rank: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
    gap: 2,
  },
  facts: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
});
