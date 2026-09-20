import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/ui/app-header';
import { Card } from '@/components/ui/card';
import { CategoryChip } from '@/components/ui/category-chip';
import { MetricTile } from '@/components/ui/metric-tile';
import { Text } from '@/components/ui/text';
import { getRouteProviderId } from '@/features/routing/services/route-service';
import { spacing } from '@/theme/spacing';

/**
 * Categorias do acesso rápido.
 *
 * Vitrine, e não atalho: quem busca por categoria faz isso na tela de destino,
 * onde a busca acontece de verdade. Aqui elas aparecem atenuadas, só para
 * firmar a identidade visual das cinco categorias do escopo.
 */
const QUICK_CATEGORIES = [
  { icon: 'gas-station', label: 'Posto', color: 'categoryFuel' },
  { icon: 'silverware-fork-knife', label: 'Restaurante', color: 'categoryFood' },
  { icon: 'bed', label: 'Hotel', color: 'categoryLodging' },
  { icon: 'hospital-box', label: 'Hospital', color: 'categoryHealth' },
] as const;

const ARCHITECTURE = [
  { title: 'features/location', description: 'Permissão de foreground e leitura do GPS.' },
  { title: 'features/map', description: 'Apresentação do mapa. Recebe tudo por props.' },
  { title: 'features/routing', description: 'Contrato RouteProvider: API do Atlas ou OSRM.' },
  { title: 'features/trip', description: 'Viagem em andamento: rota, progresso e manobras.' },
  {
    title: 'features/trip-session',
    description: 'Registro da viagem: diário de bordo, paradas, resumo e histórico.',
  },
  { title: 'features/emergency', description: 'Hospital, SAMU 192 e Polícia 190.' },
  { title: 'features/device', description: 'Identificador anônimo do aparelho, sem login.' },
  {
    title: 'features/camera',
    description: 'Câmera da viagem: classe da cena e foto do ponto turístico.',
  },
  {
    title: 'features/voice',
    description: 'Palavra "Atlas", comandos, resposta falada e emoção na fala.',
  },
  { title: 'features/api-status', description: 'Estado da API e dos três modelos de IA.' },
] as const;

/** Aba de contexto: o que já existe, o que vem depois e de onde vêm os números. */
export default function AboutScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <AppHeader />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Text variant="bodySoft" color="textSecondary">
          Copiloto de viagem multimodal — projeto acadêmico da Faculdade Anhanguera. Mapa e rotas,
          busca por texto e por categoria, voz com palavra de ativação, emoção na fala,
          classificação da cena pela câmera, Random Forest recomendando a próxima ação com
          justificativa, diário de bordo, resumo, histórico sem login e emergência.
        </Text>

        <MetricTile
          icon="source-branch"
          label="Provider de rotas ativo"
          value={getRouteProviderId()}
          span="full"
        />

        <Card tone="muted" style={styles.note}>
          <Text variant="label" color="textSecondary">
            SERVIDOR DE DEMONSTRAÇÃO
          </Text>
          <Text variant="bodySoft" color="textSecondary">
            O OSRM público não tem SLA e não permite uso comercial. Trocar por Google Routes ou
            Mapbox é escrever um arquivo, não mexer nas telas.
          </Text>
        </Card>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="heading">Categorias do escopo</Text>
            <Text variant="label" color="textSecondary">
              Buscar na aba Destino
            </Text>
          </View>

          <View style={styles.chips}>
            {QUICK_CATEGORIES.map((category) => (
              <CategoryChip
                key={category.label}
                icon={category.icon}
                label={category.label}
                color={category.color}
                inactive
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text variant="heading">Arquitetura</Text>

          {ARCHITECTURE.map((item) => (
            <Card key={item.title} style={styles.item}>
              <Text variant="body">{item.title}</Text>
              <Text variant="bodySoft" color="textSecondary">
                {item.description}
              </Text>
            </Card>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    gap: spacing.lg,
  },
  note: {
    gap: spacing.xs,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  item: {
    gap: 2,
    paddingVertical: spacing.md,
  },
});
