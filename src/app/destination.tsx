import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryChip } from '@/components/ui/category-chip';
import { PlaceRow } from '@/components/ui/place-row';
import { SearchField } from '@/components/ui/search-field';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusMessage } from '@/components/ui/status-message';
import { Text } from '@/components/ui/text';
import { usePlaceSearch } from '@/features/destination/hooks/use-place-search';
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
} as const;

const NO_PLACES: Place[] = [];

/**
 * Definir destino (RF-04, RF-07, RF-08).
 *
 * Duas portas:
 *
 * - **Categorias do escopo** — Posto, Restaurante, Hotel, Ponto turístico e
 *   Hospital. Tocar uma busca as **3 opções mais próximas**, com distância,
 *   tempo de carro e nota, pela API do Atlas (Google Places ou TomTom, com o
 *   OpenStreetMap de reserva). Tocar de novo volta à lista.
 * - **Busca por texto**: os lugares salvos primeiro e, atrás deles, qualquer
 *   lugar ou endereço achado pela TomTom, os mais perto primeiro.
 *
 * Escolher qualquer lugar abre a viagem direto (RF-09).
 */
export default function DestinationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string; query?: string; voice?: string }>();
  const location = useCurrentLocation();
  const search = usePlaceSearch(location.coordinate);
  const nearby = useNearbySearch();
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

  // 3 opções de uma busca falada: lidas e escolhidas por voz.
  useEffect(() => {
    const places = nearby.result?.places;
    if (!places || !readOptionsByVoice.current) {
      return;
    }
    readOptionsByVoice.current = false;

    const intro = `Encontrei ${places.length} ${places.length === 1 ? 'opção' : 'opções'}.`;
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
          `Não encontrei ${pending.text} entre os lugares salvos. Para achar o que está perto, diga uma categoria, como posto ou restaurante.`,
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
  const nearbyEnabled = isNearbyAvailable() && location.coordinate !== null;
  const categoryLabel = SCOPE_CATEGORIES.find((c) => c.id === nearby.category)?.label;

  return (
    <View style={styles.screen}>
      <FlatList
        data={showingNearby ? NO_PLACES : search.results}
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
            />

            <VoiceIndicator voice={voice} />

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
                As opções próximas vêm da API do Atlas — configure EXPO_PUBLIC_ATLAS_API_URL.
              </Text>
            ) : !location.coordinate && !location.isLoading ? (
              <Text variant="label" color="textSecondary">
                Sem localização, não há como achar o que está perto.
              </Text>
            ) : null}

            {showingNearby ? (
              <>
                <SectionHeader title={`${categoryLabel} mais próximos`} hint="3 opções" />
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
                  title={search.query.length > 0 ? 'Resultados' : 'Salvos'}
                  hint={search.isEmpty ? undefined : `${search.results.length}`}
                />
                {search.error ? <StatusMessage tone="error" message={search.error} /> : null}
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
          showingNearby ? null : search.isLoading ? (
            <StatusMessage tone="info" message="Buscando lugares…" busy />
          ) : (
            <Text variant="bodySoft" color="textSecondary" align="center" style={styles.empty}>
              Nenhum lugar salvo com esse nome. Para achar o que está perto, toque numa categoria.
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
