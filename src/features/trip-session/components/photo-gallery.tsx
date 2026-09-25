import { Image } from 'expo-image';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { IMAGE_CLASS_LABELS } from '@/features/trip-session/constants/journal-labels';
import type { TripPhoto } from '@/features/trip-session/types/trip';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';
import { formatDateTime } from '@/utils/date-time';

export type PhotoGalleryProps = {
  photos: TripPhoto[];
};

/**
 * Fotos da viagem em ordem cronológica (§7.2, CA-14), numa faixa que rola na
 * horizontal. Cada foto mostra a classe que a IA deu a ela.
 */
export function PhotoGallery({ photos }: PhotoGalleryProps) {
  if (photos.length === 0) {
    return (
      <Text variant="bodySoft" color="textSecondary">
        Nenhuma foto nesta viagem. Diga &quot;Atlas, registrar ponto turístico&quot; para guardar
        uma.
      </Text>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}>
      {photos.map((photo) => (
        <View key={photo.id} style={styles.item}>
          {/* O link da foto expira: `recyclingKey` evita que o cache mostre um link velho. */}
          <Image
            source={{ uri: photo.url }}
            style={styles.image}
            contentFit="cover"
            recyclingKey={photo.id}
            transition={150}
            accessibilityLabel={
              photo.imageClass ? IMAGE_CLASS_LABELS[photo.imageClass] : 'Foto da viagem'
            }
          />
          <Text variant="label" numberOfLines={1}>
            {photo.imageClass ? IMAGE_CLASS_LABELS[photo.imageClass] : 'Sem classe'}
          </Text>
          <Text variant="label" color="textSecondary" numberOfLines={1}>
            {formatDateTime(photo.takenAt)}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: {
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  item: {
    width: 148,
    gap: spacing.xs,
  },
  image: {
    width: 148,
    height: 112,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
});
