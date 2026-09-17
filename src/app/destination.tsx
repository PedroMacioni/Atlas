import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryChip } from '@/components/ui/category-chip';
import { PlaceRow } from '@/components/ui/place-row';
import { SearchField } from '@/components/ui/search-field';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusMessage } from '@/components/ui/status-message';
import { Text } from '@/components/ui/text';
import { PLACE_CATEGORIES } from '@/features/destination/constants/place-categories';
import { usePlaceSearch } from '@/features/destination/hooks/use-place-search';
import type { Place } from '@/features/destination/types/place';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

/** Ícone e cor de cada categoria, para as linhas da lista. */
const CATEGORY_VISUALS = {
  fuel: { icon: 'gas-station', color: 'categoryFuel' },
  food: { icon: 'silverware-fork-knife', color: 'categoryFood' },
  parking: { icon: 'car-brake-parking', color: 'categoryLodging' },
  saved: { icon: 'bookmark', color: 'categoryHealth' },
} as const;

/**
 * Definir destino.
 *
 * Busca por texto e filtros por categoria. Os lugares vêm da API do Atlas
 * quando ela está configurada, e da lista local quando não — a tela é a mesma
 * nos dois casos. Escolher um destino abre a viagem e a rota é calculada de
 * verdade para as coordenadas dele — não é uma tela de fachada.
 *
 * O cabeçalho e o botão de voltar são os nativos da plataforma, configurados
 * em `_layout.tsx`. O microfone existe mas está atenuado: captura de voz é uma
 * fase futura.
 */
export default function DestinationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const search = usePlaceSearch();

  const openTrip = (place: Place) => {
    router.push({
      pathname: '/trip',
      params: {
        name: place.name,
        latitude: String(place.latitude),
        longitude: String(place.longitude),
      },
    });
  };

  const sectionTitle = search.query.length > 0 || search.category ? 'Resultados' : 'Recentes';

  return (
    <View style={styles.screen}>
      <FlatList
        data={search.results}
        keyExtractor={(place) => place.id}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        ListHeaderComponent={
          <View style={styles.header}>
            <SearchField
              value={search.query}
              onChangeText={search.setQuery}
              placeholder="Para onde?"
              onVoicePress={() => {}}
              voiceDisabled
            />

            <View style={styles.categories}>
              {PLACE_CATEGORIES.map((category) => (
                <CategoryChip
                  key={category.id}
                  icon={category.icon}
                  label={category.label}
                  color={category.color}
                  selected={search.category === category.id}
                  onPress={() => search.toggleCategory(category.id)}
                />
              ))}
            </View>

            <SectionHeader
              title={sectionTitle}
              hint={search.isEmpty ? undefined : `${search.results.length}`}
            />

            {search.error ? (
              <StatusMessage tone="error" message={search.error} />
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const visual = CATEGORY_VISUALS[item.category];

          return (
            <PlaceRow
              icon={visual.icon}
              iconColor={visual.color}
              title={item.name}
              subtitle={item.address}
              onPress={() => openTrip(item)}
            />
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          search.isLoading ? (
            <StatusMessage tone="info" message="Buscando lugares…" busy />
          ) : (
            <Text variant="bodySoft" color="textSecondary" align="center" style={styles.empty}>
              Nenhum lugar encontrado. A busca por endereço completo chega com o Google Places.
            </Text>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  header: {
    gap: spacing.lg,
    paddingBottom: spacing.md,
  },
  categories: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  separator: {
    height: spacing.sm,
  },
  empty: {
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
});
