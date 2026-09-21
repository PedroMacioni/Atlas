import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryChip } from '@/components/ui/category-chip';
import { FilterPill } from '@/components/ui/filter-pill';
import { PlaceRow } from '@/components/ui/place-row';
import { SearchField } from '@/components/ui/search-field';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusMessage } from '@/components/ui/status-message';
import { Text } from '@/components/ui/text';
import { usePlaceSearch } from '@/features/destination/hooks/use-place-search';
import { useRecentDestinations } from '@/features/destination/hooks/use-recent-destinations';
import type { Place } from '@/features/destination/types/place';
import { useCurrentLocation } from '@/features/location/hooks/use-current-location';
import type { NamedCoordinate } from '@/features/map/types/coordinate';
import { NearbyOptions } from '@/features/nearby/components/nearby-options';
import { useNearbySearch } from '@/features/nearby/hooks/use-nearby-search';
import { isNearbyAvailable } from '@/features/nearby/services/nearby-service';
import { SCOPE_CATEGORIES, type NearbyCategory } from '@/features/nearby/types/nearby';
import { VoiceIndicator } from '@/features/voice/components/voice-indicator';
import { useVoice } from '@/features/voice/hooks/use-voice';
import { parseCommand } from '@/features/voice/utils/command-parser';
import { chooseOptionByVoice, confirmByVoice } from '@/features/voice/utils/voice-dialogs';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

/** Ícone e cor de cada categoria do catálogo, para as linhas da lista. */
const CATALOG_VISUALS = {
  fuel: { icon: 'gas-station', color: 'categoryFuel' },
  food: { icon: 'silverware-fork-knife', color: 'categoryFood' },
  parking: { icon: 'car-brake-parking', color: 'categoryLodging' },
  saved: { icon: 'bookmark', color: 'categoryHealth' },
  other: { icon: 'map-marker', color: 'primary' },
  recent: { icon: 'history', color: 'textSecondary' },
} as const;

const NO_PLACES: Place[] = [];

/**
 * Quantas opções próximas a lista mostra. O escopo pede 3 (RF-08); aqui, com
 * a tela inteira para rolar, vão 10. A voz continua lendo só as 3 primeiras.
 */
const NEARBY_LIST_LIMIT = 10;

/**
 * Definir destino (RF-04, RF-07, RF-08).
 *
 * Duas portas:
 *
 * - **Categorias do escopo** — Posto, Restaurante, Hotel, Ponto turístico e
 *   Hospital. Tocar uma busca as **10 opções mais próximas**, com distância,
 *   tempo de carro e nota, pela API do Atlas (Google Places ou TomTom, com o
 *   OpenStreetMap de reserva). Tocar de novo volta à lista.
 * - **Busca por texto**: os lugares salvos primeiro e, atrás deles, qualquer
 *   lugar ou endereço achado pela TomTom, os mais perto primeiro.
 *
 * Sem texto, a lista mostra os **últimos destinos**, do histórico de viagens.
 * O filtro **Salvos** troca a lista pelos lugares salvos — e, com texto, busca
 * só entre eles.
 *
 * Escolher qualquer lugar abre a viagem direto (RF-09).
 */
export default function DestinationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string; query?: string; voice?: string }>();
  const location = useCurrentLocation();
  const search = usePlaceSearch(location.coordinate);
  const nearby = useNearbySearch(null, NEARBY_LIST_LIMIT);
  const recent = useRecentDestinations();
  const voice = useVoice();

  /*
    Conversa por voz (RF-05, RF-06, RF-13, RF-14). Quando a busca nasce de uma
    fala — vinda da tela Início ou do microfone daqui —, o resultado é lido em
    voz alta e a escolha é feita por voz. Os refs marcam que a próxima
    resposta da busca é de um pedido falado.
  */
  const readOptionsByVoice = useRef(params.voice === '1');
  const pendingQuery = useRef<{ text: string; sawLoading: boolean } | null>(
    params.voice === '1' && params.query ? { text: params.query, sawLoading: false } : null,
  );

  const openTrip = (place: NamedCoordinate) => {
    router.push({
      pathname: '/trip',
      params: {
        name: place.name,
        latitude: String(place.latitude),
        longitude: String(place.longitude),
      },
    });
  };

  const searchPlaceByVoice = (text: string) => {
    nearby.clear();
    // Um lugar pedido por voz pode estar em qualquer lugar, não só nos salvos.
    if (search.category === 'saved') {
      search.toggleCategory('saved');
    }
    pendingQuery.current = { text, sawLoading: false };
    search.setQuery(text);
  };

  // A busca pedida na tela Início chega por parâmetro e dispara uma vez só —
  // a categoria espera a localização, que resolve depois da montagem.
  const [autoHandled, setAutoHandled] = useState(false);

  if (!autoHandled) {
    const category = SCOPE_CATEGORIES.find((c) => c.id === params.category)?.id;

    if (params.query) {
      setAutoHandled(true);
      search.setQuery(params.query);
    } else if (category && location.coordinate) {
      setAutoHandled(true);
      nearby.search(category, location.coordinate);
    } else if (!category || (!location.isLoading && !location.coordinate)) {
      setAutoHandled(true);
    }
  }

  // Opções de uma busca falada: as 3 primeiras lidas e escolhidas por voz.
  useEffect(() => {
    const places = nearby.result?.places;
    if (!places || !readOptionsByVoice.current) {
      return;
    }
    readOptionsByVoice.current = false;

    // A voz lê só as 3 primeiras; o resto fica na tela.
    const intro =
      places.length > 3
        ? `Encontrei ${places.length} opções. As três mais perto:`
        : `Encontrei ${places.length} ${places.length === 1 ? 'opção' : 'opções'}.`;
    chooseOptionByVoice(voice, places, intro)
      .then((index) => {
        if (index !== null) {
          openTrip(places[index]);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearby.result]);

  // Um lugar pedido pelo nome: quando a busca termina, confirma por voz.
  useEffect(() => {
    const pending = pendingQuery.current;
    if (!pending) {
      return;
    }
    if (search.isLoading) {
      pending.sawLoading = true;
      return;
    }
    if (!pending.sawLoading) {
      return;
    }
    pendingQuery.current = null;

    const first = search.results[0];
    (async () => {
      if (!first) {
        await voice.say(
          `Não encontrei ${pending.text}. Para achar o que está perto, diga uma categoria, como posto ou restaurante.`,
        );
        return;
      }
      const accepted = await confirmByVoice(voice, `Encontrei ${first.name}. Quer ir para lá?`);
      if (accepted) {
        openTrip(first);
      }
    })().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.isLoading, search.results]);

  /** Microfone do campo "Para onde?". */
  const onVoicePress = () => {
    if (voice.state === 'listening') {
      voice.finish();
      return;
    }
    if (voice.state !== 'idle') {
      return;
    }

    (async () => {
      let heard = await voice.listen();
      if (!heard?.transcript) {
        return;
      }

      let command = parseCommand(heard.transcript);
      if (command.type === 'ask_destination') {
        await voice.say('Para onde você quer ir?');
        heard = await voice.listen();
        if (!heard?.transcript) {
          return;
        }
        command = parseCommand(heard.transcript);
      }

      if (command.type === 'go_category' || command.type === 'add_stop') {
        if (!location.coordinate) {
          await voice.say('Sem localização, não consigo achar o que está perto.');
          return;
        }
        readOptionsByVoice.current = true;
        nearby.search(command.category, location.coordinate);
      } else if (command.type === 'emergency' || command.type === 'unwell') {
        router.push('/emergency');
      } else {
        searchPlaceByVoice(command.type === 'go_place' ? command.query : heard.transcript);
      }
    })().catch(() => {});
  };

  const toggleCategory = (category: NearbyCategory) => {
    if (nearby.category === category) {
      nearby.clear();
      return;
    }
    if (location.coordinate) {
      nearby.search(category, location.coordinate);
    }
  };

  const showingNearby = nearby.category !== null;
  const showingSaved = search.category === 'saved';
  // Sem texto e sem filtro: os últimos destinos, e não o catálogo.
  const showingRecent = !showingSaved && search.query.trim().length === 0;
  const listData = showingNearby ? NO_PLACES : showingRecent ? recent.places : search.results;
  const listTitle = showingSaved ? 'Salvos' : showingRecent ? 'Últimos' : 'Resultados';
  const listLoading = showingRecent ? recent.isLoading : search.isLoading;
  const nearbyEnabled = isNearbyAvailable() && location.coordinate !== null;
  const categoryLabel = SCOPE_CATEGORIES.find((c) => c.id === nearby.category)?.label;

  return (
    <View style={styles.screen}>
      <FlatList
        data={listData}
        keyExtractor={(place) => place.id}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        ListHeaderComponent={
          <View style={styles.header}>
            <SearchField
              value={search.query}
              onChangeText={(value) => {
                nearby.clear();
                search.setQuery(value);
              }}
              placeholder="Para onde?"
              onVoicePress={onVoicePress}
              voiceDisabled={!voice.available}
              tone="floating"
            />

            <VoiceIndicator voice={voice} />

            <View style={styles.categoryHeading}>
              <Text variant="heading">Encontre perto de você</Text>
              <Text variant="label" color="textSecondary">
                {nearbyEnabled ? 'Escolha uma opção' : 'Indisponível agora'}
              </Text>
            </View>

            <View style={styles.categories}>
              {SCOPE_CATEGORIES.map((category) => (
                <CategoryChip
                  key={category.id}
                  icon={category.icon}
                  label={category.label}
                  color={category.color}
                  selected={nearby.category === category.id}
                  inactive={!nearbyEnabled}
                  onPress={() => toggleCategory(category.id)}
                />
              ))}
            </View>

            {!isNearbyAvailable() ? (
              <Text variant="label" color="textSecondary">
                As opções próximas estão indisponíveis no momento.
              </Text>
            ) : !location.coordinate && !location.isLoading ? (
              <Text variant="label" color="textSecondary">
                Sem localização, não há como achar o que está perto.
              </Text>
            ) : null}

            {showingNearby ? (
              <>
                <SectionHeader
                  title={`${categoryLabel} mais próximos`}
                  hint={nearby.result ? `${nearby.result.places.length} opções` : undefined}
                />
                <NearbyOptions
                  result={nearby.result}
                  isLoading={nearby.isLoading}
                  error={nearby.error}
                  onRetry={nearby.retry}
                  onSelect={(place) => openTrip(place)}
                />
              </>
            ) : (
              <>
                <SectionHeader
                  title={listTitle}
                  hint={listData.length > 0 ? `${listData.length}` : undefined}
                  accessory={
                    <FilterPill
                      icon="bookmark"
                      label="Salvos"
                      selected={showingSaved}
                      onPress={() => search.toggleCategory('saved')}
                    />
                  }
                />
                {search.error && !showingRecent ? (
                  <StatusMessage tone="error" message={search.error} />
                ) : null}
              </>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const visual = CATALOG_VISUALS[item.category];

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
          showingNearby ? null : listLoading ? (
            <StatusMessage tone="info" message="Buscando lugares…" busy />
          ) : (
            <Text variant="bodySoft" color="textSecondary" align="center" style={styles.empty}>
              {emptyMessage({ showingRecent, showingSaved, recentUnavailable: recent.unavailable })}
            </Text>
          )
        }
      />
    </View>
  );
}

function emptyMessage({
  showingRecent,
  showingSaved,
  recentUnavailable,
}: {
  showingRecent: boolean;
  showingSaved: boolean;
  recentUnavailable: boolean;
}): string {
  if (showingRecent) {
    return recentUnavailable
      ? 'Não foi possível carregar os últimos destinos. Busque um lugar acima.'
      : 'Nenhuma viagem ainda. Busque um lugar acima ou toque numa categoria.';
  }
  if (showingSaved) {
    return 'Nenhum lugar salvo com esse nome.';
  }
  return 'Nenhum lugar encontrado com esse nome. Para achar o que está perto, toque numa categoria.';
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  header: {
    gap: spacing.lg,
    paddingBottom: spacing.md,
  },
  categoryHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
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
