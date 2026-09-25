import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/ui/app-header';
import { StatusMessage } from '@/components/ui/status-message';
import { Text } from '@/components/ui/text';
import { TripHistoryCard } from '@/features/trip-session/components/trip-history-card';
import { useTripHistory } from '@/features/trip-session/hooks/use-trip-history';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

/**
 * Histórico de viagens (RF-27, RF-28).
 *
 * Sem login: mostra as viagens deste aparelho (pelo id anônimo). Não há opção
 * de apagar; o histórico é mantido (RF-30).
 */
export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const history = useTripHistory();
  const trips = history.data ?? [];

  return (
    <View style={styles.screen}>
      <AppHeader />

      <FlatList
        data={trips}
        keyExtractor={(trip) => trip.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text variant="title">Suas viagens</Text>
            <Text variant="bodySoft" color="textSecondary">
              {trips.length > 0
                ? `${trips.length} ${trips.length === 1 ? 'trajeto registrado' : 'trajetos registrados'}`
                : 'Seus trajetos aparecerão aqui.'}
            </Text>
            {history.error ? (
              <StatusMessage tone="error" message={history.error} onRetry={history.reload} />
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <TripHistoryCard
            trip={item}
            onPress={() => router.push({ pathname: '/history/[id]', params: { id: item.id } })}
          />
        )}
        ListEmptyComponent={
          !history.isAvailable ? (
            <Text variant="bodySoft" color="textSecondary" align="center" style={styles.empty}>
              O histórico fica na API do Atlas. Defina EXPO_PUBLIC_ATLAS_API_URL e suba o backend
              para registrar viagens.
            </Text>
          ) : history.isLoading ? (
            <StatusMessage tone="info" message="Carregando viagens…" busy />
          ) : history.error ? null : (
            <Text variant="bodySoft" color="textSecondary" align="center" style={styles.empty}>
              Nenhuma viagem ainda. Inicie uma na aba Início.
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
    paddingTop: spacing.xs,
  },
  header: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  separator: {
    height: spacing.sm,
  },
  empty: {
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
});
